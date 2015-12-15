/* */ 
var isObjectLike = require('../internal/isObjectLike');
var errorTag = '[object Error]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
function isError(value) {
  return isObjectLike(value) && typeof value.message == 'string' && objToString.call(value) == errorTag;
}
module.exports = isError;
