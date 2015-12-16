// TODO:
//   * The process object is an EventEmitter. Make it hebave properly in the
//     context of zones.
//   * `process.on('SIGxxx', cb)` implicitly constructs a signal watcher -
//      decide what to do with that (add to the root zone and unref?)
//   * Investigate what the zone implications are for
//     - cluster messaging: `process.on('message')`

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var isv010 = require('../isv010.js');

var realProcess = global.process;
var process = global.process = new EventEmitter();

process.nextTick = function(cb) {
  global.zone.scheduleMicrotask(cb);
};

function createWritableStdioStream(fd) {
  var stream;
  var tty_wrap = process.binding('tty_wrap');

  // Note stream._type is used for test-module-load-list.js

  switch (tty_wrap.guessHandleType(fd)) {
    case 'TTY':
      var tty = require('tty');
      stream = new tty.WriteStream(fd);
      stream._type = 'tty';

      // Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    case 'FILE':
      var fs = require('fs');
      stream = new fs.SyncWriteStream(fd, { autoClose: false });
      stream._type = 'fs';
      break;

    case 'PIPE':
    case 'TCP':
      var net = require('net');
      stream = new net.Socket({
        fd: fd,
        readable: false,
        writable: true
      });

      // FIXME Should probably have an option in net.Socket to create a
      // stream from an existing fd which is writable only. But for now
      // we'll just add this hack and set the `readable` member to false.
      // Test: ./node test/fixtures/echo.js < /etc/passwd
      stream.readable = false;
      stream.read = null;
      stream._type = 'pipe';

      // FIXME Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    default:
      // Probably an error on in uv_guess_handle()
      throw new Error('Implement me. Unknown stream file type!');
  }

  // For supporting legacy API we put the FD here.
  stream.fd = fd;

  stream._isStdio = true;

  return stream;
}

var stdin, stdout, stderr;

delete process.stdin;
delete process.stdout;
delete process.stderr;

process.__defineGetter__('stdout', function() {
  if (stdout) return stdout;

  var previousZone = global.zone;
  global.zone = global.zone.root;

  stdout = createWritableStdioStream(1);
  stdout.destroy = stdout.destroySoon = function(er) {
    er = er || new Error('process.stdout cannot be closed.');
    stdout.emit('error', er);
  };
  if (stdout.isTTY) {
    process.on('SIGWINCH', function() {
      stdout._refreshSize();
    });
  }
  return stdout;
});

process.__defineGetter__('stderr', function() {
  if (stderr) return stderr;

  var previousZone = global.zone;
  global.zone = global.zone.root;

  stderr = createWritableStdioStream(2);
  stderr.destroy = stderr.destroySoon = function(er) {
    er = er || new Error('process.stderr cannot be closed.');
    stderr.emit('error', er);
  };

  global.zone = previousZone;

  return stderr;
});

process.__defineGetter__('stdin', function() {
  if (stdin) return stdin;

  var previousZone = global.zone;
  global.zone = global.zone.root;

  var tty_wrap = process.binding('tty_wrap');
  var fd = 0;

  switch (tty_wrap.guessHandleType(fd)) {
    case 'TTY':
      var tty = require('tty');
      stdin = new tty.ReadStream(fd, {
        highWaterMark: 0,
        readable: true,
        writable: false
      });
      break;

    case 'FILE':
      var fs = require('fs');
      stdin = new fs.ReadStream(null, { fd: fd, autoClose: false });
      break;

    case 'PIPE':
    case 'TCP':
      var net = require('net');
      stdin = new net.Socket({
        fd: fd,
        readable: true,
        writable: false
      });
      break;

    default:
      // Probably an error on in uv_guess_handle()
      throw new Error('Implement me. Unknown stdin file type!');
  }

  // For supporting legacy API we put the FD here.
  stdin.fd = fd;

  // stdin starts out life in a paused state, but node doesn't
  // know yet.  Explicitly to readStop() it to put it in the
  // not-reading state.
  if (stdin._handle && stdin._handle.readStop) {
    stdin._handle.reading = false;
    stdin._readableState.reading = false;
    stdin._handle.readStop();
  }

  // if the user calls stdin.pause(), then we need to stop reading
  // immediately, so that the process can close down.
  stdin.on('pause', function() {
    if (!stdin._handle)
      return;
    stdin._readableState.reading = false;
    stdin._handle.reading = false;
    stdin._handle.readStop();
  });

  global.zone = previousZone;

  return stdin;
});

if (isv010) {
  process.__defineGetter__('_errno', function() {
    return realProcess._errno;
  });
}

for (var key in realProcess) {
  if (!process.hasOwnProperty(key) &&
      realProcess.hasOwnProperty(key))
    process[key] = realProcess[key];
}
