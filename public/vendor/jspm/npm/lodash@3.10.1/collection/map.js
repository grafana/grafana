/* */ 
var arrayMap = require('../internal/arrayMap'),
    baseCallback = require('../internal/baseCallback'),
    baseMap = require('../internal/baseMap'),
    isArray = require('../lang/isArray');
function map(collection, iteratee, thisArg) {
  var func = isArray(collection) ? arrayMap : baseMap;
  iteratee = baseCallback(iteratee, thisArg, 3);
  return func(collection, iteratee);
}
module.exports = map;
