/* */ 
var cachePush = require('./cachePush'),
    getNative = require('./getNative');
var Set = getNative(global, 'Set');
var nativeCreate = getNative(Object, 'create');
function SetCache(values) {
  var length = values ? values.length : 0;
  this.data = {
    'hash': nativeCreate(null),
    'set': new Set
  };
  while (length--) {
    this.push(values[length]);
  }
}
SetCache.prototype.push = cachePush;
module.exports = SetCache;
