/* */ 
var baseCallback = require('../internal/baseCallback'),
    basePullAt = require('../internal/basePullAt');
function remove(array, predicate, thisArg) {
  var result = [];
  if (!(array && array.length)) {
    return result;
  }
  var index = -1,
      indexes = [],
      length = array.length;
  predicate = baseCallback(predicate, thisArg, 3);
  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result.push(value);
      indexes.push(index);
    }
  }
  basePullAt(array, indexes);
  return result;
}
module.exports = remove;
