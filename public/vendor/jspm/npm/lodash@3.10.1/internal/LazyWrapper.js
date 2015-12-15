/* */ 
var baseCreate = require('./baseCreate'),
    baseLodash = require('./baseLodash');
var POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
function LazyWrapper(value) {
  this.__wrapped__ = value;
  this.__actions__ = [];
  this.__dir__ = 1;
  this.__filtered__ = false;
  this.__iteratees__ = [];
  this.__takeCount__ = POSITIVE_INFINITY;
  this.__views__ = [];
}
LazyWrapper.prototype = baseCreate(baseLodash.prototype);
LazyWrapper.prototype.constructor = LazyWrapper;
module.exports = LazyWrapper;
