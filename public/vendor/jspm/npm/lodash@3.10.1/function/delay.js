/* */ 
var baseDelay = require('../internal/baseDelay'),
    restParam = require('./restParam');
var delay = restParam(function(func, wait, args) {
  return baseDelay(func, wait, args);
});
module.exports = delay;
