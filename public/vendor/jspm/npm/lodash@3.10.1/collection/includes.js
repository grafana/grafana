/* */ 
var baseIndexOf = require('../internal/baseIndexOf'),
    getLength = require('../internal/getLength'),
    isArray = require('../lang/isArray'),
    isIterateeCall = require('../internal/isIterateeCall'),
    isLength = require('../internal/isLength'),
    isString = require('../lang/isString'),
    values = require('../object/values');
var nativeMax = Math.max;
function includes(collection, target, fromIndex, guard) {
  var length = collection ? getLength(collection) : 0;
  if (!isLength(length)) {
    collection = values(collection);
    length = collection.length;
  }
  if (typeof fromIndex != 'number' || (guard && isIterateeCall(target, fromIndex, guard))) {
    fromIndex = 0;
  } else {
    fromIndex = fromIndex < 0 ? nativeMax(length + fromIndex, 0) : (fromIndex || 0);
  }
  return (typeof collection == 'string' || !isArray(collection) && isString(collection)) ? (fromIndex <= length && collection.indexOf(target, fromIndex) > -1) : (!!length && baseIndexOf(collection, target, fromIndex) > -1);
}
module.exports = includes;
