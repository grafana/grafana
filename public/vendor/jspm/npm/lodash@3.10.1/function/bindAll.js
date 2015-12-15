/* */ 
var baseFlatten = require('../internal/baseFlatten'),
    createWrapper = require('../internal/createWrapper'),
    functions = require('../object/functions'),
    restParam = require('./restParam');
var BIND_FLAG = 1;
var bindAll = restParam(function(object, methodNames) {
  methodNames = methodNames.length ? baseFlatten(methodNames) : functions(object);
  var index = -1,
      length = methodNames.length;
  while (++index < length) {
    var key = methodNames[index];
    object[key] = createWrapper(object[key], BIND_FLAG, object);
  }
  return object;
});
module.exports = bindAll;
