/* */ 
var baseDelay = require('../internal/baseDelay'),
    restParam = require('./restParam');
var defer = restParam(function(func, args) {
  return baseDelay(func, 1, args);
});
module.exports = defer;
