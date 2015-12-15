/* */ 
var isObjectLike = require('../internal/isObjectLike');
var stringTag = '[object String]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
function isString(value) {
  return typeof value == 'string' || (isObjectLike(value) && objToString.call(value) == stringTag);
}
module.exports = isString;
