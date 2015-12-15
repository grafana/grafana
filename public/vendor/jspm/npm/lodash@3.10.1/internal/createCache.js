/* */ 
var SetCache = require('./SetCache'),
    getNative = require('./getNative');
var Set = getNative(global, 'Set');
var nativeCreate = getNative(Object, 'create');
function createCache(values) {
  return (nativeCreate && Set) ? new SetCache(values) : null;
}
module.exports = createCache;
