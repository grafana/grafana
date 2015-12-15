/* */ 
var isObjectLike = require('../internal/isObjectLike');
var boolTag = '[object Boolean]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
function isBoolean(value) {
  return value === true || value === false || (isObjectLike(value) && objToString.call(value) == boolTag);
}
module.exports = isBoolean;
