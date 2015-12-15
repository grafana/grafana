/* */ 
var baseFlatten = require('../internal/baseFlatten'),
    bindCallback = require('../internal/bindCallback'),
    pickByArray = require('../internal/pickByArray'),
    pickByCallback = require('../internal/pickByCallback'),
    restParam = require('../function/restParam');
var pick = restParam(function(object, props) {
  if (object == null) {
    return {};
  }
  return typeof props[0] == 'function' ? pickByCallback(object, bindCallback(props[0], props[1], 3)) : pickByArray(object, baseFlatten(props));
});
module.exports = pick;
