/* */ 
var getNative = require('./getNative');
var WeakMap = getNative(global, 'WeakMap');
var metaMap = WeakMap && new WeakMap;
module.exports = metaMap;
