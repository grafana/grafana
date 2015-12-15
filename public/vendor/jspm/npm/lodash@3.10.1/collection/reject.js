/* */ 
var arrayFilter = require('../internal/arrayFilter'),
    baseCallback = require('../internal/baseCallback'),
    baseFilter = require('../internal/baseFilter'),
    isArray = require('../lang/isArray');
function reject(collection, predicate, thisArg) {
  var func = isArray(collection) ? arrayFilter : baseFilter;
  predicate = baseCallback(predicate, thisArg, 3);
  return func(collection, function(value, index, collection) {
    return !predicate(value, index, collection);
  });
}
module.exports = reject;
