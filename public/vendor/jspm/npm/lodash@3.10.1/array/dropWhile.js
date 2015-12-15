/* */ 
var baseCallback = require('../internal/baseCallback'),
    baseWhile = require('../internal/baseWhile');
function dropWhile(array, predicate, thisArg) {
  return (array && array.length) ? baseWhile(array, baseCallback(predicate, thisArg, 3), true) : [];
}
module.exports = dropWhile;
