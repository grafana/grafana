/* */ 
var baseFill = require('../internal/baseFill'),
    isIterateeCall = require('../internal/isIterateeCall');
function fill(array, value, start, end) {
  var length = array ? array.length : 0;
  if (!length) {
    return [];
  }
  if (start && typeof start != 'number' && isIterateeCall(array, value, start)) {
    start = 0;
    end = length;
  }
  return baseFill(array, value, start, end);
}
module.exports = fill;
