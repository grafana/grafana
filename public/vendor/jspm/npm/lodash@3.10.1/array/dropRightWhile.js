/* */ 
var baseCallback = require('../internal/baseCallback'),
    baseWhile = require('../internal/baseWhile');
function dropRightWhile(array, predicate, thisArg) {
  return (array && array.length) ? baseWhile(array, baseCallback(predicate, thisArg, 3), true, true) : [];
}
module.exports = dropRightWhile;
