/* */ 
var baseIndexOf = require('./baseIndexOf'),
    cacheIndexOf = require('./cacheIndexOf'),
    createCache = require('./createCache');
var LARGE_ARRAY_SIZE = 200;
function baseUniq(array, iteratee) {
  var index = -1,
      indexOf = baseIndexOf,
      length = array.length,
      isCommon = true,
      isLarge = isCommon && length >= LARGE_ARRAY_SIZE,
      seen = isLarge ? createCache() : null,
      result = [];
  if (seen) {
    indexOf = cacheIndexOf;
    isCommon = false;
  } else {
    isLarge = false;
    seen = iteratee ? [] : result;
  }
  outer: while (++index < length) {
    var value = array[index],
        computed = iteratee ? iteratee(value, index, array) : value;
    if (isCommon && value === value) {
      var seenIndex = seen.length;
      while (seenIndex--) {
        if (seen[seenIndex] === computed) {
          continue outer;
        }
      }
      if (iteratee) {
        seen.push(computed);
      }
      result.push(value);
    } else if (indexOf(seen, computed, 0) < 0) {
      if (iteratee || isLarge) {
        seen.push(computed);
      }
      result.push(value);
    }
  }
  return result;
}
module.exports = baseUniq;
