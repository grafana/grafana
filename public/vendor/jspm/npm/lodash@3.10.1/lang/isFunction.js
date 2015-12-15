/* */ 
var isObject = require('./isObject');
var funcTag = '[object Function]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
function isFunction(value) {
  return isObject(value) && objToString.call(value) == funcTag;
}
module.exports = isFunction;
