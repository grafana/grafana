/* */ 
var createAggregator = require('../internal/createAggregator');
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
var countBy = createAggregator(function(result, value, key) {
  hasOwnProperty.call(result, key) ? ++result[key] : (result[key] = 1);
});
module.exports = countBy;
