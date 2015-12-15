/* */ 
var getNative = require('../internal/getNative'),
    isLength = require('../internal/isLength'),
    isObjectLike = require('../internal/isObjectLike');
var arrayTag = '[object Array]';
var objectProto = Object.prototype;
var objToString = objectProto.toString;
var nativeIsArray = getNative(Array, 'isArray');
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};
module.exports = isArray;
