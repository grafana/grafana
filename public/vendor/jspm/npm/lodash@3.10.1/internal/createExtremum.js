/* */ 
var arrayExtremum = require('./arrayExtremum'),
    baseCallback = require('./baseCallback'),
    baseExtremum = require('./baseExtremum'),
    isArray = require('../lang/isArray'),
    isIterateeCall = require('./isIterateeCall'),
    toIterable = require('./toIterable');
function createExtremum(comparator, exValue) {
  return function(collection, iteratee, thisArg) {
    if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
      iteratee = undefined;
    }
    iteratee = baseCallback(iteratee, thisArg, 3);
    if (iteratee.length == 1) {
      collection = isArray(collection) ? collection : toIterable(collection);
      var result = arrayExtremum(collection, iteratee, comparator, exValue);
      if (!(collection.length && result === exValue)) {
        return result;
      }
    }
    return baseExtremum(collection, iteratee, comparator, exValue);
  };
}
module.exports = createExtremum;
