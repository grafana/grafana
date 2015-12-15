/* */ 
(function(process) {
  module.exports = Duplex;
  var objectKeys = Object.keys || function(obj) {
    var keys = [];
    for (var key in obj)
      keys.push(key);
    return keys;
  };
  var util = require('core-util-is');
  util.inherits = require('inherits');
  var Readable = require('./_stream_readable');
  var Writable = require('./_stream_writable');
  util.inherits(Duplex, Readable);
  forEach(objectKeys(Writable.prototype), function(method) {
    if (!Duplex.prototype[method])
      Duplex.prototype[method] = Writable.prototype[method];
  });
  function Duplex(options) {
    if (!(this instanceof Duplex))
      return new Duplex(options);
    Readable.call(this, options);
    Writable.call(this, options);
    if (options && options.readable === false)
      this.readable = false;
    if (options && options.writable === false)
      this.writable = false;
    this.allowHalfOpen = true;
    if (options && options.allowHalfOpen === false)
      this.allowHalfOpen = false;
    this.once('end', onend);
  }
  function onend() {
    if (this.allowHalfOpen || this._writableState.ended)
      return;
    process.nextTick(this.end.bind(this));
  }
  function forEach(xs, f) {
    for (var i = 0,
        l = xs.length; i < l; i++) {
      f(xs[i], i);
    }
  }
})(require('process'));
