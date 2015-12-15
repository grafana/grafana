/* */ 
var identity = require('../utility/identity');
function bindCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  if (thisArg === undefined) {
    return func;
  }
  switch (argCount) {
    case 1:
      return function(value) {
        return func.call(thisArg, value);
      };
    case 3:
      return function(value, index, collection) {
        return func.call(thisArg, value, index, collection);
      };
    case 4:
      return function(accumulator, value, index, collection) {
        return func.call(thisArg, accumulator, value, index, collection);
      };
    case 5:
      return function(value, other, key, object, source) {
        return func.call(thisArg, value, other, key, object, source);
      };
  }
  return function() {
    return func.apply(thisArg, arguments);
  };
}
module.exports = bindCallback;
