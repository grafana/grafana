/* */ 
var baseEach = require('./baseEach');
function baseExtremum(collection, iteratee, comparator, exValue) {
  var computed = exValue,
      result = computed;
  baseEach(collection, function(value, index, collection) {
    var current = +iteratee(value, index, collection);
    if (comparator(current, computed) || (current === exValue && current === result)) {
      computed = current;
      result = value;
    }
  });
  return result;
}
module.exports = baseExtremum;
