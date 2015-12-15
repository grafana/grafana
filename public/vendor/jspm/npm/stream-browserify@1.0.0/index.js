/* */ 
module.exports = Stream;
var EE = require('events').EventEmitter;
var inherits = require('inherits');
inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable');
Stream.Writable = require('readable-stream/writable');
Stream.Duplex = require('readable-stream/duplex');
Stream.Transform = require('readable-stream/transform');
Stream.PassThrough = require('readable-stream/passthrough');
Stream.Stream = Stream;
function Stream() {
  EE.call(this);
}
Stream.prototype.pipe = function(dest, options) {
  var source = this;
  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }
  source.on('data', ondata);
  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }
  dest.on('drain', ondrain);
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }
  var didOnEnd = false;
  function onend() {
    if (didOnEnd)
      return;
    didOnEnd = true;
    dest.end();
  }
  function onclose() {
    if (didOnEnd)
      return;
    didOnEnd = true;
    if (typeof dest.destroy === 'function')
      dest.destroy();
  }
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er;
    }
  }
  source.on('error', onerror);
  dest.on('error', onerror);
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);
    source.removeListener('end', onend);
    source.removeListener('close', onclose);
    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);
    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);
    dest.removeListener('close', cleanup);
  }
  source.on('end', cleanup);
  source.on('close', cleanup);
  dest.on('close', cleanup);
  dest.emit('pipe', source);
  return dest;
};
