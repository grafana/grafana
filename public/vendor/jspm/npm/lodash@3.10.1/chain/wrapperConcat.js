/* */ 
var arrayConcat = require('../internal/arrayConcat'),
    baseFlatten = require('../internal/baseFlatten'),
    isArray = require('../lang/isArray'),
    restParam = require('../function/restParam'),
    toObject = require('../internal/toObject');
var wrapperConcat = restParam(function(values) {
  values = baseFlatten(values);
  return this.thru(function(array) {
    return arrayConcat(isArray(array) ? array : [toObject(array)], values);
  });
});
module.exports = wrapperConcat;
