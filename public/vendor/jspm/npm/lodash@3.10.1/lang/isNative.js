/* */ 
var isFunction = require('./isFunction'),
    isObjectLike = require('../internal/isObjectLike');
var reIsHostCtor = /^\[object .+?Constructor\]$/;
var objectProto = Object.prototype;
var fnToString = Function.prototype.toString;
var hasOwnProperty = objectProto.hasOwnProperty;
var reIsNative = RegExp('^' + fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&').replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}
module.exports = isNative;
