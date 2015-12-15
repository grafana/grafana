/* */ 
var baseRandom = require('../internal/baseRandom'),
    isIterateeCall = require('../internal/isIterateeCall'),
    toArray = require('../lang/toArray'),
    toIterable = require('../internal/toIterable');
var nativeMin = Math.min;
function sample(collection, n, guard) {
  if (guard ? isIterateeCall(collection, n, guard) : n == null) {
    collection = toIterable(collection);
    var length = collection.length;
    return length > 0 ? collection[baseRandom(0, length - 1)] : undefined;
  }
  var index = -1,
      result = toArray(collection),
      length = result.length,
      lastIndex = length - 1;
  n = nativeMin(n < 0 ? 0 : (+n || 0), length);
  while (++index < n) {
    var rand = baseRandom(index, lastIndex),
        value = result[rand];
    result[rand] = result[index];
    result[index] = value;
  }
  result.length = n;
  return result;
}
module.exports = sample;
