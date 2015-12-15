/* */ 
var baseIndexOf = require('./baseIndexOf'),
    cacheIndexOf = require('./cacheIndexOf'),
    createCache = require('./createCache');
var LARGE_ARRAY_SIZE = 200;
function baseDifference(array, values) {
  var length = array ? array.length : 0,
      result = [];
  if (!length) {
    return result;
  }
  var index = -1,
      indexOf = baseIndexOf,
      isCommon = true,
      cache = (isCommon && values.length >= LARGE_ARRAY_SIZE) ? createCache(values) : null,
      valuesLength = values.length;
  if (cache) {
    indexOf = cacheIndexOf;
    isCommon = false;
    values = cache;
  }
  outer: while (++index < length) {
    var value = array[index];
    if (isCommon && value === value) {
      var valuesIndex = valuesLength;
      while (valuesIndex--) {
        if (values[valuesIndex] === value) {
          continue outer;
        }
      }
      result.push(value);
    } else if (indexOf(values, value, 0) < 0) {
      result.push(value);
    }
  }
  return result;
}
module.exports = baseDifference;
