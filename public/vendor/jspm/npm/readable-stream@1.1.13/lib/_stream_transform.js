/* */ 
(function(process) {
  module.exports = Transform;
  var Duplex = require('./_stream_duplex');
  var util = require('core-util-is');
  util.inherits = require('inherits');
  util.inherits(Transform, Duplex);
  function TransformState(options, stream) {
    this.afterTransform = function(er, data) {
      return afterTransform(stream, er, data);
    };
    this.needTransform = false;
    this.transforming = false;
    this.writecb = null;
    this.writechunk = null;
  }
  function afterTransform(stream, er, data) {
    var ts = stream._transformState;
    ts.transforming = false;
    var cb = ts.writecb;
    if (!cb)
      return stream.emit('error', new Error('no writecb in Transform class'));
    ts.writechunk = null;
    ts.writecb = null;
    if (!util.isNullOrUndefined(data))
      stream.push(data);
    if (cb)
      cb(er);
    var rs = stream._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      stream._read(rs.highWaterMark);
    }
  }
  function Transform(options) {
    if (!(this instanceof Transform))
      return new Transform(options);
    Duplex.call(this, options);
    this._transformState = new TransformState(options, this);
    var stream = this;
    this._readableState.needReadable = true;
    this._readableState.sync = false;
    this.once('prefinish', function() {
      if (util.isFunction(this._flush))
        this._flush(function(er) {
          done(stream, er);
        });
      else
        done(stream);
    });
  }
  Transform.prototype.push = function(chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex.prototype.push.call(this, chunk, encoding);
  };
  Transform.prototype._transform = function(chunk, encoding, cb) {
    throw new Error('not implemented');
  };
  Transform.prototype._write = function(chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark)
        this._read(rs.highWaterMark);
    }
  };
  Transform.prototype._read = function(n) {
    var ts = this._transformState;
    if (!util.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      ts.needTransform = true;
    }
  };
  function done(stream, er) {
    if (er)
      return stream.emit('error', er);
    var ws = stream._writableState;
    var ts = stream._transformState;
    if (ws.length)
      throw new Error('calling transform done when ws.length != 0');
    if (ts.transforming)
      throw new Error('calling transform done when still transforming');
    return stream.push(null);
  }
})(require('process'));
