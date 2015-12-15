/* */ 
var baseEach = require('../internal/baseEach'),
    invokePath = require('../internal/invokePath'),
    isArrayLike = require('../internal/isArrayLike'),
    isKey = require('../internal/isKey'),
    restParam = require('../function/restParam');
var invoke = restParam(function(collection, path, args) {
  var index = -1,
      isFunc = typeof path == 'function',
      isProp = isKey(path),
      result = isArrayLike(collection) ? Array(collection.length) : [];
  baseEach(collection, function(value) {
    var func = isFunc ? path : ((isProp && value != null) ? value[path] : undefined);
    result[++index] = func ? func.apply(value, args) : invokePath(value, path, args);
  });
  return result;
});
module.exports = invoke;
