/* */ 
var baseAt = require('../internal/baseAt'),
    baseCompareAscending = require('../internal/baseCompareAscending'),
    baseFlatten = require('../internal/baseFlatten'),
    basePullAt = require('../internal/basePullAt'),
    restParam = require('../function/restParam');
var pullAt = restParam(function(array, indexes) {
  indexes = baseFlatten(indexes);
  var result = baseAt(array, indexes);
  basePullAt(array, indexes.sort(baseCompareAscending));
  return result;
});
module.exports = pullAt;
