/* */ 
var arraySum = require('../internal/arraySum'),
    baseCallback = require('../internal/baseCallback'),
    baseSum = require('../internal/baseSum'),
    isArray = require('../lang/isArray'),
    isIterateeCall = require('../internal/isIterateeCall'),
    toIterable = require('../internal/toIterable');
function sum(collection, iteratee, thisArg) {
  if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
    iteratee = undefined;
  }
  iteratee = baseCallback(iteratee, thisArg, 3);
  return iteratee.length == 1 ? arraySum(isArray(collection) ? collection : toIterable(collection), iteratee) : baseSum(collection, iteratee);
}
module.exports = sum;
