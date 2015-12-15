/* */ 
var baseFlatten = require('../internal/baseFlatten'),
    isIterateeCall = require('../internal/isIterateeCall');
function flatten(array, isDeep, guard) {
  var length = array ? array.length : 0;
  if (guard && isIterateeCall(array, isDeep, guard)) {
    isDeep = false;
  }
  return length ? baseFlatten(array, isDeep) : [];
}
module.exports = flatten;
