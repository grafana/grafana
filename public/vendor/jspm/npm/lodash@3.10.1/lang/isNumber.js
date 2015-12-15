/* */ 
var isObjectLike = require('../internal/isObjectLike');
var numberTag = '[object Number]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
function isNumber(value) {
  return typeof value == 'number' || (isObjectLike(value) && objToString.call(value) == numberTag);
}
module.exports = isNumber;
