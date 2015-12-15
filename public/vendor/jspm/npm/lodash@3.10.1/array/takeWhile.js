/* */ 
var baseCallback = require('../internal/baseCallback'),
    baseWhile = require('../internal/baseWhile');
function takeWhile(array, predicate, thisArg) {
  return (array && array.length) ? baseWhile(array, baseCallback(predicate, thisArg, 3)) : [];
}
module.exports = takeWhile;
