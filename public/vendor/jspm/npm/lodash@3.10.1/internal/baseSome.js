/* */ 
var baseEach = require('./baseEach');
function baseSome(collection, predicate) {
  var result;
  baseEach(collection, function(value, index, collection) {
    result = predicate(value, index, collection);
    return !result;
  });
  return !!result;
}
module.exports = baseSome;
