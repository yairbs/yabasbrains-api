const express = require('express');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex')
const clarifai = require('clarifai');

const app = express();
app.use(express.json());
app.use(cors());

const clarifaiApp = new clarifai.App({
    apiKey: '656a1aa3e5b84d00a589ae03a4418595'
   });

const db = knex({
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      user : 'postgres',
      password : 'ybspostgres',
      database : 'smartbrains'
    }
  });

app.listen(process.env.PORT || 3000, () => {
    console.log(`app is running on port ${process.env.PORT}`);
})

app.post('/signin', (req,res) => {
    const {email, password} = req.body;
    if(!email || !password){
        return res.status(400).json('Incorrect form submission');
    }
    db.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
        const isValid = bcrypt.compareSync(password, data[0].hash);
        if(isValid){
            return db.select('*').from('users')
                    .where('email', '=', email)
                    .then( user => {
                        res.json(user[0])
                    })
                    .catch(err => res.status(400).json('Unable to get User'))
        } else{
            res.status(400).json('Wrong Credentials');
        }
    })
    .catch(err => res.status(400).json('Wrong Credentials'))
})

app.post('/register', (req,res) => {
    const {email, name, password} = req.body;
    if(!email || !name || !password){
        return res.status(400).json('Incorrect form submission');
    }
    const hash = bcrypt.hashSync(password);
    db.transaction(trx => {
        trx.insert({
            hash: hash,
            email: email
        })
        .into('login')
        .returning('email')
        .then(loginEmail => {
            return trx('users')
                .returning('*')
                .insert({
                    email: loginEmail[0],
                    name: name,
                    joined: new Date()
                })
                .then(user => {
                    res.json(user[0])
                })
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
    .catch(err => res.status(400).json(err))
})

app.get('/profile/:id', (req,res) => {
    const { id } = req.params;
    db.select('*')
    .from('users').where({id: id})
    .then(user => {
        if(user.length) {
            res.json(user[0]);
        } else {
            res.status(400).json('User not found');
        }
    })
})


app.post('/imageurl', (req, res) => {
    clarifaiApp.models.predict(
        Clarifai.FACE_DETECT_MODEL,
        req.body.input)
        .then(data => res.json(data))
        .then(err => res.status(400).json('Unable to work with API'))
})

app.put('/image', (req, res) => {
    const { id } = req.body;
    db('users').where('id', '=', id).increment('entries', 1)
    .returning('entries')
    .then(entries => {
        res.json(entries[0]);
    })
    .catch(err => res.status(400).json('Unable to get rank'))
})  

