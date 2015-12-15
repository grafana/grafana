/* */ 
(function(Buffer, process) {
  module.exports = Readable;
  var isArray = require('isarray');
  var Buffer = require('buffer').Buffer;
  Readable.ReadableState = ReadableState;
  var EE = require('events').EventEmitter;
  if (!EE.listenerCount)
    EE.listenerCount = function(emitter, type) {
      return emitter.listeners(type).length;
    };
  var Stream = require('stream-browserify/index');
  var util = require('core-util-is');
  util.inherits = require('inherits');
  var StringDecoder;
  var debug = require('@empty');
  if (debug && debug.debuglog) {
    debug = debug.debuglog('stream');
  } else {
    debug = function() {};
  }
  util.inherits(Readable, Stream);
  function ReadableState(options, stream) {
    var Duplex = require('./_stream_duplex');
    options = options || {};
    var hwm = options.highWaterMark;
    var defaultHwm = options.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;
    this.highWaterMark = ~~this.highWaterMark;
    this.buffer = [];
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;
    this.sync = true;
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListening = false;
    this.objectMode = !!options.objectMode;
    if (stream instanceof Duplex)
      this.objectMode = this.objectMode || !!options.readableObjectMode;
    this.defaultEncoding = options.defaultEncoding || 'utf8';
    this.ranOut = false;
    this.awaitDrain = 0;
    this.readingMore = false;
    this.decoder = null;
    this.encoding = null;
    if (options.encoding) {
      if (!StringDecoder)
        StringDecoder = require('string_decoder').StringDecoder;
      this.decoder = new StringDecoder(options.encoding);
      this.encoding = options.encoding;
    }
  }
  function Readable(options) {
    var Duplex = require('./_stream_duplex');
    if (!(this instanceof Readable))
      return new Readable(options);
    this._readableState = new ReadableState(options, this);
    this.readable = true;
    Stream.call(this);
  }
  Readable.prototype.push = function(chunk, encoding) {
    var state = this._readableState;
    if (util.isString(chunk) && !state.objectMode) {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = new Buffer(chunk, encoding);
        encoding = '';
      }
    }
    return readableAddChunk(this, state, chunk, encoding, false);
  };
  Readable.prototype.unshift = function(chunk) {
    var state = this._readableState;
    return readableAddChunk(this, state, chunk, '', true);
  };
  function readableAddChunk(stream, state, chunk, encoding, addToFront) {
    var er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (util.isNullOrUndefined(chunk)) {
      state.reading = false;
      if (!state.ended)
        onEofChunk(stream, state);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (state.ended && !addToFront) {
        var e = new Error('stream.push() after EOF');
        stream.emit('error', e);
      } else if (state.endEmitted && addToFront) {
        var e = new Error('stream.unshift() after end event');
        stream.emit('error', e);
      } else {
        if (state.decoder && !addToFront && !encoding)
          chunk = state.decoder.write(chunk);
        if (!addToFront)
          state.reading = false;
        if (state.flowing && state.length === 0 && !state.sync) {
          stream.emit('data', chunk);
          stream.read(0);
        } else {
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront)
            state.buffer.unshift(chunk);
          else
            state.buffer.push(chunk);
          if (state.needReadable)
            emitReadable(stream);
        }
        maybeReadMore(stream, state);
      }
    } else if (!addToFront) {
      state.reading = false;
    }
    return needMoreData(state);
  }
  function needMoreData(state) {
    return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
  }
  Readable.prototype.setEncoding = function(enc) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder').StringDecoder;
    this._readableState.decoder = new StringDecoder(enc);
    this._readableState.encoding = enc;
    return this;
  };
  var MAX_HWM = 0x800000;
  function roundUpToNextPowerOf2(n) {
    if (n >= MAX_HWM) {
      n = MAX_HWM;
    } else {
      n--;
      for (var p = 1; p < 32; p <<= 1)
        n |= n >> p;
      n++;
    }
    return n;
  }
  function howMuchToRead(n, state) {
    if (state.length === 0 && state.ended)
      return 0;
    if (state.objectMode)
      return n === 0 ? 0 : 1;
    if (isNaN(n) || util.isNull(n)) {
      if (state.flowing && state.buffer.length)
        return state.buffer[0].length;
      else
        return state.length;
    }
    if (n <= 0)
      return 0;
    if (n > state.highWaterMark)
      state.highWaterMark = roundUpToNextPowerOf2(n);
    if (n > state.length) {
      if (!state.ended) {
        state.needReadable = true;
        return 0;
      } else
        return state.length;
    }
    return n;
  }
  Readable.prototype.read = function(n) {
    debug('read', n);
    var state = this._readableState;
    var nOrig = n;
    if (!util.isNumber(n) || n > 0)
      state.emittedReadable = false;
    if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
      debug('read: emitReadable', state.length, state.ended);
      if (state.length === 0 && state.ended)
        endReadable(this);
      else
        emitReadable(this);
      return null;
    }
    n = howMuchToRead(n, state);
    if (n === 0 && state.ended) {
      if (state.length === 0)
        endReadable(this);
      return null;
    }
    var doRead = state.needReadable;
    debug('need readable', doRead);
    if (state.length === 0 || state.length - n < state.highWaterMark) {
      doRead = true;
      debug('length less than watermark', doRead);
    }
    if (state.ended || state.reading) {
      doRead = false;
      debug('reading or ended', doRead);
    }
    if (doRead) {
      debug('do read');
      state.reading = true;
      state.sync = true;
      if (state.length === 0)
        state.needReadable = true;
      this._read(state.highWaterMark);
      state.sync = false;
    }
    if (doRead && !state.reading)
      n = howMuchToRead(nOrig, state);
    var ret;
    if (n > 0)
      ret = fromList(n, state);
    else
      ret = null;
    if (util.isNull(ret)) {
      state.needReadable = true;
      n = 0;
    }
    state.length -= n;
    if (state.length === 0 && !state.ended)
      state.needReadable = true;
    if (nOrig !== n && state.ended && state.length === 0)
      endReadable(this);
    if (!util.isNull(ret))
      this.emit('data', ret);
    return ret;
  };
  function chunkInvalid(state, chunk) {
    var er = null;
    if (!util.isBuffer(chunk) && !util.isString(chunk) && !util.isNullOrUndefined(chunk) && !state.objectMode) {
      er = new TypeError('Invalid non-string/buffer chunk');
    }
    return er;
  }
  function onEofChunk(stream, state) {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) {
        state.buffer.push(chunk);
        state.length += state.objectMode ? 1 : chunk.length;
      }
    }
    state.ended = true;
    emitReadable(stream);
  }
  function emitReadable(stream) {
    var state = stream._readableState;
    state.needReadable = false;
    if (!state.emittedReadable) {
      debug('emitReadable', state.flowing);
      state.emittedReadable = true;
      if (state.sync)
        process.nextTick(function() {
          emitReadable_(stream);
        });
      else
        emitReadable_(stream);
    }
  }
  function emitReadable_(stream) {
    debug('emit readable');
    stream.emit('readable');
    flow(stream);
  }
  function maybeReadMore(stream, state) {
    if (!state.readingMore) {
      state.readingMore = true;
      process.nextTick(function() {
        maybeReadMore_(stream, state);
      });
    }
  }
  function maybeReadMore_(stream, state) {
    var len = state.length;
    while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
      debug('maybeReadMore read 0');
      stream.read(0);
      if (len === state.length)
        break;
      else
        len = state.length;
    }
    state.readingMore = false;
  }
  Readable.prototype._read = function(n) {
    this.emit('error', new Error('not implemented'));
  };
  Readable.prototype.pipe = function(dest, pipeOpts) {
    var src = this;
    var state = this._readableState;
    switch (state.pipesCount) {
      case 0:
        state.pipes = dest;
        break;
      case 1:
        state.pipes = [state.pipes, dest];
        break;
      default:
        state.pipes.push(dest);
        break;
    }
    state.pipesCount += 1;
    debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);
    var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
    var endFn = doEnd ? onend : cleanup;
    if (state.endEmitted)
      process.nextTick(endFn);
    else
      src.once('end', endFn);
    dest.on('unpipe', onunpipe);
    function onunpipe(readable) {
      debug('onunpipe');
      if (readable === src) {
        cleanup();
      }
    }
    function onend() {
      debug('onend');
      dest.end();
    }
    var ondrain = pipeOnDrain(src);
    dest.on('drain', ondrain);
    function cleanup() {
      debug('cleanup');
      dest.removeListener('close', onclose);
      dest.removeListener('finish', onfinish);
      dest.removeListener('drain', ondrain);
      dest.removeListener('error', onerror);
      dest.removeListener('unpipe', onunpipe);
      src.removeListener('end', onend);
      src.removeListener('end', cleanup);
      src.removeListener('data', ondata);
      if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain))
        ondrain();
    }
    src.on('data', ondata);
    function ondata(chunk) {
      debug('ondata');
      var ret = dest.write(chunk);
      if (false === ret) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        src.pause();
      }
    }
    function onerror(er) {
      debug('onerror', er);
      unpipe();
      dest.removeListener('error', onerror);
      if (EE.listenerCount(dest, 'error') === 0)
        dest.emit('error', er);
    }
    if (!dest._events || !dest._events.error)
      dest.on('error', onerror);
    else if (isArray(dest._events.error))
      dest._events.error.unshift(onerror);
    else
      dest._events.error = [onerror, dest._events.error];
    function onclose() {
      dest.removeListener('finish', onfinish);
      unpipe();
    }
    dest.once('close', onclose);
    function onfinish() {
      debug('onfinish');
      dest.removeListener('close', onclose);
      unpipe();
    }
    dest.once('finish', onfinish);
    function unpipe() {
      debug('unpipe');
      src.unpipe(dest);
    }
    dest.emit('pipe', src);
    if (!state.flowing) {
      debug('pipe resume');
      src.resume();
    }
    return dest;
  };
  function pipeOnDrain(src) {
    return function() {
      var state = src._readableState;
      debug('pipeOnDrain', state.awaitDrain);
      if (state.awaitDrain)
        state.awaitDrain--;
      if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
        state.flowing = true;
        flow(src);
      }
    };
  }
  Readable.prototype.unpipe = function(dest) {
    var state = this._readableState;
    if (state.pipesCount === 0)
      return this;
    if (state.pipesCount === 1) {
      if (dest && dest !== state.pipes)
        return this;
      if (!dest)
        dest = state.pipes;
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;
      if (dest)
        dest.emit('unpipe', this);
      return this;
    }
    if (!dest) {
      var dests = state.pipes;
      var len = state.pipesCount;
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;
      for (var i = 0; i < len; i++)
        dests[i].emit('unpipe', this);
      return this;
    }
    var i = indexOf(state.pipes, dest);
    if (i === -1)
      return this;
    state.pipes.splice(i, 1);
    state.pipesCount -= 1;
    if (state.pipesCount === 1)
      state.pipes = state.pipes[0];
    dest.emit('unpipe', this);
    return this;
  };
  Readable.prototype.on = function(ev, fn) {
    var res = Stream.prototype.on.call(this, ev, fn);
    if (ev === 'data' && false !== this._readableState.flowing) {
      this.resume();
    }
    if (ev === 'readable' && this.readable) {
      var state = this._readableState;
      if (!state.readableListening) {
        state.readableListening = true;
        state.emittedReadable = false;
        state.needReadable = true;
        if (!state.reading) {
          var self = this;
          process.nextTick(function() {
            debug('readable nexttick read 0');
            self.read(0);
          });
        } else if (state.length) {
          emitReadable(this, state);
        }
      }
    }
    return res;
  };
  Readable.prototype.addListener = Readable.prototype.on;
  Readable.prototype.resume = function() {
    var state = this._readableState;
    if (!state.flowing) {
      debug('resume');
      state.flowing = true;
      if (!state.reading) {
        debug('resume read 0');
        this.read(0);
      }
      resume(this, state);
    }
    return this;
  };
  function resume(stream, state) {
    if (!state.resumeScheduled) {
      state.resumeScheduled = true;
      process.nextTick(function() {
        resume_(stream, state);
      });
    }
  }
  function resume_(stream, state) {
    state.resumeScheduled = false;
    stream.emit('resume');
    flow(stream);
    if (state.flowing && !state.reading)
      stream.read(0);
  }
  Readable.prototype.pause = function() {
    debug('call pause flowing=%j', this._readableState.flowing);
    if (false !== this._readableState.flowing) {
      debug('pause');
      this._readableState.flowing = false;
      this.emit('pause');
    }
    return this;
  };
  function flow(stream) {
    var state = stream._readableState;
    debug('flow', state.flowing);
    if (state.flowing) {
      do {
        var chunk = stream.read();
      } while (null !== chunk && state.flowing);
    }
  }
  Readable.prototype.wrap = function(stream) {
    var state = this._readableState;
    var paused = false;
    var self = this;
    stream.on('end', function() {
      debug('wrapped end');
      if (state.decoder && !state.ended) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length)
          self.push(chunk);
      }
      self.push(null);
    });
    stream.on('data', function(chunk) {
      debug('wrapped data');
      if (state.decoder)
        chunk = state.decoder.write(chunk);
      if (!chunk || !state.objectMode && !chunk.length)
        return;
      var ret = self.push(chunk);
      if (!ret) {
        paused = true;
        stream.pause();
      }
    });
    for (var i in stream) {
      if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
        this[i] = function(method) {
          return function() {
            return stream[method].apply(stream, arguments);
          };
        }(i);
      }
    }
    var events = ['error', 'close', 'destroy', 'pause', 'resume'];
    forEach(events, function(ev) {
      stream.on(ev, self.emit.bind(self, ev));
    });
    self._read = function(n) {
      debug('wrapped _read', n);
      if (paused) {
        paused = false;
        stream.resume();
      }
    };
    return self;
  };
  Readable._fromList = fromList;
  function fromList(n, state) {
    var list = state.buffer;
    var length = state.length;
    var stringMode = !!state.decoder;
    var objectMode = !!state.objectMode;
    var ret;
    if (list.length === 0)
      return null;
    if (length === 0)
      ret = null;
    else if (objectMode)
      ret = list.shift();
    else if (!n || n >= length) {
      if (stringMode)
        ret = list.join('');
      else
        ret = Buffer.concat(list, length);
      list.length = 0;
    } else {
      if (n < list[0].length) {
        var buf = list[0];
        ret = buf.slice(0, n);
        list[0] = buf.slice(n);
      } else if (n === list[0].length) {
        ret = list.shift();
      } else {
        if (stringMode)
          ret = '';
        else
          ret = new Buffer(n);
        var c = 0;
        for (var i = 0,
            l = list.length; i < l && c < n; i++) {
          var buf = list[0];
          var cpy = Math.min(n - c, buf.length);
          if (stringMode)
            ret += buf.slice(0, cpy);
          else
            buf.copy(ret, c, 0, cpy);
          if (cpy < buf.length)
            list[0] = buf.slice(cpy);
          else
            list.shift();
          c += cpy;
        }
      }
    }
    return ret;
  }
  function endReadable(stream) {
    var state = stream._readableState;
    if (state.length > 0)
      throw new Error('endReadable called on non-empty stream');
    if (!state.endEmitted) {
      state.ended = true;
      process.nextTick(function() {
        if (!state.endEmitted && state.length === 0) {
          state.endEmitted = true;
          stream.readable = false;
          stream.emit('end');
        }
      });
    }
  }
  function forEach(xs, f) {
    for (var i = 0,
        l = xs.length; i < l; i++) {
      f(xs[i], i);
    }
  }
  function indexOf(xs, x) {
    for (var i = 0,
        l = xs.length; i < l; i++) {
      if (xs[i] === x)
        return i;
    }
    return -1;
  }
})(require('buffer').Buffer, require('process'));
