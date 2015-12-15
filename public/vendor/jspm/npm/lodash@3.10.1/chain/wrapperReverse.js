/* */ 
var LazyWrapper = require('../internal/LazyWrapper'),
    LodashWrapper = require('../internal/LodashWrapper'),
    thru = require('./thru');
function wrapperReverse() {
  var value = this.__wrapped__;
  var interceptor = function(value) {
    return value.reverse();
  };
  if (value instanceof LazyWrapper) {
    var wrapped = value;
    if (this.__actions__.length) {
      wrapped = new LazyWrapper(this);
    }
    wrapped = wrapped.reverse();
    wrapped.__actions__.push({
      'func': thru,
      'args': [interceptor],
      'thisArg': undefined
    });
    return new LodashWrapper(wrapped, this.__chain__);
  }
  return this.thru(interceptor);
}
module.exports = wrapperReverse;
