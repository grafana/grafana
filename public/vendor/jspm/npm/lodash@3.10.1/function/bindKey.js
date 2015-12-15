/* */ 
var createWrapper = require('../internal/createWrapper'),
    replaceHolders = require('../internal/replaceHolders'),
    restParam = require('./restParam');
var BIND_FLAG = 1,
    BIND_KEY_FLAG = 2,
    PARTIAL_FLAG = 32;
var bindKey = restParam(function(object, key, partials) {
  var bitmask = BIND_FLAG | BIND_KEY_FLAG;
  if (partials.length) {
    var holders = replaceHolders(partials, bindKey.placeholder);
    bitmask |= PARTIAL_FLAG;
  }
  return createWrapper(key, bitmask, object, partials, holders);
});
bindKey.placeholder = {};
module.exports = bindKey;
