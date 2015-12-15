/* */ 
var baseAt = require('../internal/baseAt'),
    baseFlatten = require('../internal/baseFlatten'),
    restParam = require('../function/restParam');
var at = restParam(function(collection, props) {
  return baseAt(collection, baseFlatten(props));
});
module.exports = at;
