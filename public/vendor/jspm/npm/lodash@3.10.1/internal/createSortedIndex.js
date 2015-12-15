/* */ 
var baseCallback = require('./baseCallback'),
    binaryIndex = require('./binaryIndex'),
    binaryIndexBy = require('./binaryIndexBy');
function createSortedIndex(retHighest) {
  return function(array, value, iteratee, thisArg) {
    return iteratee == null ? binaryIndex(array, value, retHighest) : binaryIndexBy(array, value, baseCallback(iteratee, thisArg, 1), retHighest);
  };
}
module.exports = createSortedIndex;
