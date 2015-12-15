/* */ 
var createAggregator = require('../internal/createAggregator');
var indexBy = createAggregator(function(result, value, key) {
  result[key] = value;
});
module.exports = indexBy;
