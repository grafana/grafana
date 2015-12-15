/* */ 
var isObjectLike = require('../internal/isObjectLike');
var dateTag = '[object Date]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
function isDate(value) {
  return isObjectLike(value) && objToString.call(value) == dateTag;
}
module.exports = isDate;
