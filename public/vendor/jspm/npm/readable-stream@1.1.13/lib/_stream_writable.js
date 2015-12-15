/* */ 
(function(Buffer, process) {
  module.exports = Writable;
  var Buffer = require('buffer').Buffer;
  Writable.WritableState = WritableState;
  var util = require('core-util-is');
  util.inherits = require('inherits');
  var Stream = require('stream-browserify/index');
  util.inherits(Writable, Stream);
  function WriteReq(chunk, encoding, cb) {
    this.chunk = chunk;
    this.encoding = encoding;
    this.callback = cb;
  }
  function WritableState(options, stream) {
    var Duplex = require('./_stream_duplex');
    options = options || {};
    var hwm = options.highWaterMark;
    var defaultHwm = options.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;
    this.objectMode = !!options.objectMode;
    if (stream instanceof Duplex)
      this.objectMode = this.objectMode || !!options.writableObjectMode;
    this.highWaterMark = ~~this.highWaterMark;
    this.needDrain = false;
    this.ending = false;
    this.ended = false;
    this.finished = false;
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;
    this.defaultEncoding = options.defaultEncoding || 'utf8';
    this.length = 0;
    this.writing = false;
    this.corked = 0;
    this.sync = true;
    this.bufferProcessing = false;
    this.onwrite = function(er) {
      onwrite(stream, er);
    };
    this.writecb = null;
    this.writelen = 0;
    this.buffer = [];
    this.pendingcb = 0;
    this.prefinished = false;
    this.errorEmitted = false;
  }
  function Writable(options) {
    var Duplex = require('./_stream_duplex');
    if (!(this instanceof Writable) && !(this instanceof Duplex))
      return new Writable(options);
    this._writableState = new WritableState(options, this);
    this.writable = true;
    Stream.call(this);
  }
  Writable.prototype.pipe = function() {
    this.emit('error', new Error('Cannot pipe. Not readable.'));
  };
  function writeAfterEnd(stream, state, cb) {
    var er = new Error('write after end');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
  }
  function validChunk(stream, state, chunk, cb) {
    var valid = true;
    if (!util.isBuffer(chunk) && !util.isString(chunk) && !util.isNullOrUndefined(chunk) && !state.objectMode) {
      var er = new TypeError('Invalid non-string/buffer chunk');
      stream.emit('error', er);
      process.nextTick(function() {
        cb(er);
      });
      valid = false;
    }
    return valid;
  }
  Writable.prototype.write = function(chunk, encoding, cb) {
    var state = this._writableState;
    var ret = false;
    if (util.isFunction(encoding)) {
      cb = encoding;
      encoding = null;
    }
    if (util.isBuffer(chunk))
      encoding = 'buffer';
    else if (!encoding)
      encoding = state.defaultEncoding;
    if (!util.isFunction(cb))
      cb = function() {};
    if (state.ended)
      writeAfterEnd(this, state, cb);
    else if (validChunk(this, state, chunk, cb)) {
      state.pendingcb++;
      ret = writeOrBuffer(this, state, chunk, encoding, cb);
    }
    return ret;
  };
  Writable.prototype.cork = function() {
    var state = this._writableState;
    state.corked++;
  };
  Writable.prototype.uncork = function() {
    var state = this._writableState;
    if (state.corked) {
      state.corked--;
      if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.buffer.length)
        clearBuffer(this, state);
    }
  };
  function decodeChunk(state, chunk, encoding) {
    if (!state.objectMode && state.decodeStrings !== false && util.isString(chunk)) {
      chunk = new Buffer(chunk, encoding);
    }
    return chunk;
  }
  function writeOrBuffer(stream, state, chunk, encoding, cb) {
    chunk = decodeChunk(state, chunk, encoding);
    if (util.isBuffer(chunk))
      encoding = 'buffer';
    var len = state.objectMode ? 1 : chunk.length;
    state.length += len;
    var ret = state.length < state.highWaterMark;
    if (!ret)
      state.needDrain = true;
    if (state.writing || state.corked)
      state.buffer.push(new WriteReq(chunk, encoding, cb));
    else
      doWrite(stream, state, false, len, chunk, encoding, cb);
    return ret;
  }
  function doWrite(stream, state, writev, len, chunk, encoding, cb) {
    state.writelen = len;
    state.writecb = cb;
    state.writing = true;
    state.sync = true;
    if (writev)
      stream._writev(chunk, state.onwrite);
    else
      stream._write(chunk, encoding, state.onwrite);
    state.sync = false;
  }
  function onwriteError(stream, state, sync, er, cb) {
    if (sync)
      process.nextTick(function() {
        state.pendingcb--;
        cb(er);
      });
    else {
      state.pendingcb--;
      cb(er);
    }
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  }
  function onwriteStateUpdate(state) {
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
  }
  function onwrite(stream, er) {
    var state = stream._writableState;
    var sync = state.sync;
    var cb = state.writecb;
    onwriteStateUpdate(state);
    if (er)
      onwriteError(stream, state, sync, er, cb);
    else {
      var finished = needFinish(stream, state);
      if (!finished && !state.corked && !state.bufferProcessing && state.buffer.length) {
        clearBuffer(stream, state);
      }
      if (sync) {
        process.nextTick(function() {
          afterWrite(stream, state, finished, cb);
        });
      } else {
        afterWrite(stream, state, finished, cb);
      }
    }
  }
  function afterWrite(stream, state, finished, cb) {
    if (!finished)
      onwriteDrain(stream, state);
    state.pendingcb--;
    cb();
    finishMaybe(stream, state);
  }
  function onwriteDrain(stream, state) {
    if (state.length === 0 && state.needDrain) {
      state.needDrain = false;
      stream.emit('drain');
    }
  }
  function clearBuffer(stream, state) {
    state.bufferProcessing = true;
    if (stream._writev && state.buffer.length > 1) {
      var cbs = [];
      for (var c = 0; c < state.buffer.length; c++)
        cbs.push(state.buffer[c].callback);
      state.pendingcb++;
      doWrite(stream, state, true, state.length, state.buffer, '', function(err) {
        for (var i = 0; i < cbs.length; i++) {
          state.pendingcb--;
          cbs[i](err);
        }
      });
      state.buffer = [];
    } else {
      for (var c = 0; c < state.buffer.length; c++) {
        var entry = state.buffer[c];
        var chunk = entry.chunk;
        var encoding = entry.encoding;
        var cb = entry.callback;
        var len = state.objectMode ? 1 : chunk.length;
        doWrite(stream, state, false, len, chunk, encoding, cb);
        if (state.writing) {
          c++;
          break;
        }
      }
      if (c < state.buffer.length)
        state.buffer = state.buffer.slice(c);
      else
        state.buffer.length = 0;
    }
    state.bufferProcessing = false;
  }
  Writable.prototype._write = function(chunk, encoding, cb) {
    cb(new Error('not implemented'));
  };
  Writable.prototype._writev = null;
  Writable.prototype.end = function(chunk, encoding, cb) {
    var state = this._writableState;
    if (util.isFunction(chunk)) {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (util.isFunction(encoding)) {
      cb = encoding;
      encoding = null;
    }
    if (!util.isNullOrUndefined(chunk))
      this.write(chunk, encoding);
    if (state.corked) {
      state.corked = 1;
      this.uncork();
    }
    if (!state.ending && !state.finished)
      endWritable(this, state, cb);
  };
  function needFinish(stream, state) {
    return (state.ending && state.length === 0 && !state.finished && !state.writing);
  }
  function prefinish(stream, state) {
    if (!state.prefinished) {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
  function finishMaybe(stream, state) {
    var need = needFinish(stream, state);
    if (need) {
      if (state.pendingcb === 0) {
        prefinish(stream, state);
        state.finished = true;
        stream.emit('finish');
      } else
        prefinish(stream, state);
    }
    return need;
  }
  function endWritable(stream, state, cb) {
    state.ending = true;
    finishMaybe(stream, state);
    if (cb) {
      if (state.finished)
        process.nextTick(cb);
      else
        stream.once('finish', cb);
    }
    state.ended = true;
  }
})(require('buffer').Buffer, require('process'));
