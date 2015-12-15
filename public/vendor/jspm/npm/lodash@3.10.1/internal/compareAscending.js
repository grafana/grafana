/* */ 
var baseCompareAscending = require('./baseCompareAscending');
function compareAscending(object, other) {
  return baseCompareAscending(object.criteria, other.criteria) || (object.index - other.index);
}
module.exports = compareAscending;
