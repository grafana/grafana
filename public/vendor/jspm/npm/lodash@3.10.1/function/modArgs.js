/* */ 
var arrayEvery = require('../internal/arrayEvery'),
    baseFlatten = require('../internal/baseFlatten'),
    baseIsFunction = require('../internal/baseIsFunction'),
    restParam = require('./restParam');
var FUNC_ERROR_TEXT = 'Expected a function';
var nativeMin = Math.min;
var modArgs = restParam(function(func, transforms) {
  transforms = baseFlatten(transforms);
  if (typeof func != 'function' || !arrayEvery(transforms, baseIsFunction)) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var length = transforms.length;
  return restParam(function(args) {
    var index = nativeMin(args.length, length);
    while (index--) {
      args[index] = transforms[index](args[index]);
    }
    return func.apply(this, args);
  });
});
module.exports = modArgs;
