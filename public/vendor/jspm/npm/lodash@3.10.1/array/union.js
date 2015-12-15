/* */ 
var baseFlatten = require('../internal/baseFlatten'),
    baseUniq = require('../internal/baseUniq'),
    restParam = require('../function/restParam');
var union = restParam(function(arrays) {
  return baseUniq(baseFlatten(arrays, false, true));
});
module.exports = union;
