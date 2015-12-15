/* */ 
var baseCallback = require('../internal/baseCallback'),
    baseMap = require('../internal/baseMap'),
    baseSortBy = require('../internal/baseSortBy'),
    compareAscending = require('../internal/compareAscending'),
    isIterateeCall = require('../internal/isIterateeCall');
function sortBy(collection, iteratee, thisArg) {
  if (collection == null) {
    return [];
  }
  if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
    iteratee = undefined;
  }
  var index = -1;
  iteratee = baseCallback(iteratee, thisArg, 3);
  var result = baseMap(collection, function(value, key, collection) {
    return {
      'criteria': iteratee(value, key, collection),
      'index': ++index,
      'value': value
    };
  });
  return baseSortBy(result, compareAscending);
}
module.exports = sortBy;
