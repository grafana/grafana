/* */ 
var invokePath = require('../internal/invokePath'),
    restParam = require('../function/restParam');
var method = restParam(function(path, args) {
  return function(object) {
    return invokePath(object, path, args);
  };
});
module.exports = method;
