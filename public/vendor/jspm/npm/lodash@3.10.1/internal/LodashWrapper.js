/* */ 
var baseCreate = require('./baseCreate'),
    baseLodash = require('./baseLodash');
function LodashWrapper(value, chainAll, actions) {
  this.__wrapped__ = value;
  this.__actions__ = actions || [];
  this.__chain__ = !!chainAll;
}
LodashWrapper.prototype = baseCreate(baseLodash.prototype);
LodashWrapper.prototype.constructor = LodashWrapper;
module.exports = LodashWrapper;
