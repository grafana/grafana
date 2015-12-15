/* */ 
var isIterateeCall = require('../internal/isIterateeCall');
var nativeCeil = Math.ceil,
    nativeMax = Math.max;
function range(start, end, step) {
  if (step && isIterateeCall(start, end, step)) {
    end = step = undefined;
  }
  start = +start || 0;
  step = step == null ? 1 : (+step || 0);
  if (end == null) {
    end = start;
    start = 0;
  } else {
    end = +end || 0;
  }
  var index = -1,
      length = nativeMax(nativeCeil((end - start) / (step || 1)), 0),
      result = Array(length);
  while (++index < length) {
    result[index] = start;
    start += step;
  }
  return result;
}
module.exports = range;
