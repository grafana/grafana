/* */ 
var baseCallback = require('../internal/baseCallback'),
    baseWhile = require('../internal/baseWhile');
function takeRightWhile(array, predicate, thisArg) {
  return (array && array.length) ? baseWhile(array, baseCallback(predicate, thisArg, 3), false, true) : [];
}
module.exports = takeRightWhile;
