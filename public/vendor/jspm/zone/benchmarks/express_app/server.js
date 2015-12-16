require('../../lib/setup.js').enable();
express = require('express');
var app = express();
var bodyParser = require('body-parser');
Error.stackTraceLimit = 0;

app.use(function(req, res, next) {
  zone.create(function RequestZone() {
    zone.data.url = req.url;
    next();
  }).catch (function(err) {
    console.error(err);
  });
});

app.use(bodyParser());
var router = express.Router();

router.get('/', function(req, res) {
  res.json({
    // zone: zone.name,
    message: 'Hello world'
  });
});

app.use('/api', router);
app.listen(3001);
