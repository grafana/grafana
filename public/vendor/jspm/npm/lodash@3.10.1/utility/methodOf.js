/* */ 
var invokePath = require('../internal/invokePath'),
    restParam = require('../function/restParam');
var methodOf = restParam(function(object, args) {
  return function(path) {
    return invokePath(object, path, args);
  };
});
module.exports = methodOf;
