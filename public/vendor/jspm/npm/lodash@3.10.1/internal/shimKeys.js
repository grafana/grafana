/* */ 
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('./isIndex'),
    isLength = require('./isLength'),
    keysIn = require('../object/keysIn');
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;
  var allowIndexes = !!length && isLength(length) && (isArray(object) || isArguments(object));
  var index = -1,
      result = [];
  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}
module.exports = shimKeys;
