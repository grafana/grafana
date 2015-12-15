/* */ 
var isObject = require('./isObject');
var regexpTag = '[object RegExp]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
function isRegExp(value) {
  return isObject(value) && objToString.call(value) == regexpTag;
}
module.exports = isRegExp;
