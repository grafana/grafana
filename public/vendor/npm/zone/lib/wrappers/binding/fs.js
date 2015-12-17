module.exports = function(binding) {
  var assert = require('assert');
  var uid = require('../../uid.js');
  var util = require('util');
  var fs = binding('fs');

  var Zone = zone.Zone;

  /**
   * The FDTracker class tracks open files and auto-closes them when the zone
   * that opened the file exits. It registers as a while of the Zone.
   *
   * @private
   */
  function FDTracker(fd, path) {
    this.fd = fd;
    this.path = path;

    this.id = uid();
    this.zone = zone;

    this.zone._registerChild(this);
  }

  /**
   * Release this object and unregister it from the parent Zone
   *
   * @private
   */
  FDTracker.prototype.release = function() {
    this.zone._unregisterChild(this);
  };

  /**
   * Close the file handle and unregister from the parent Zone
   *
   * @private
   */
  FDTracker.prototype.signal = function() {
    fs.close(this.fd);
    this.zone._unregisterChild(this);
  };

  /**
   * Debug function which returns a string with the current state.
   *
   * @return {String}
   */
  FDTracker.prototype.dump = function(options) {
    var indent = options.indent || 0;
    var prefix = (new Array(indent + 1)).join('  ');

    return util.format('%s [File        ] #%d (fd: %d, path: %s)\n',
        prefix, this.id, this.fd, this.path);
  };

  FDTracker.table = [];

  /**
   * Create a new FDTracker and register it with the Zone
   */
  FDTracker.register = function(fd, path) {
    assert(this.table[fd] === undefined);
    this.table[fd] = new FDTracker(fd, path);
  };

  /**
   * Release the FDTracker class
   */
  FDTracker.unregister = function(fd) {
    var fdTracker = this.table[fd];
    assert(fdTracker);
    fdTracker.release();
    delete this.table[fd];
  };

  // Opening and closing a file descriptor

  var readFsOpen = fs.open;
  fs.open = function open(path, flags, mode, callback) {
    // If no callback was specified then call the synchronous binding.
    if (typeof callback !== 'function') {
      var fd = readFsOpen(path, flags, mode);
      if (fd >= 0) {
        FDTracker.register(fd, path);
      }
      return fd;
    }

    function wrappedOpenCallback(err, fd) {
      // If open succeeded, add the FD to the tracker. Use gate.run so the
      // file descripter gets registered to the right zone.
      if (!err && fd >= 0) {
        FDTracker.register(fd, path);
      }
      zone.applyAsync(this, callback, arguments);
    }

    cb = zone.bindCallback(this, wrappedOpenCallback, null, {name: 'fs.open'});

    var result, error, res;
    res = callWrapped(readFsOpen, this, [path, flags, mode, cb]);
    result = res[0];
    error = res[1];

    if (error || result < 0) {
      zone.releaseCallback(cb);
    }

    if (error) {
      throw error;
    } else {
      return result;
    }
  };

  var realFsClose = fs.close;
  fs.close = function close(fd, callback) {
    FDTracker.unregister(fd);

    var wrappedCallback = null;
    if (typeof callback === 'function') {
      wrappedCallback =
          zone.bindAsyncCallback(this, callback, null, {name: 'fs.close'});
    }

    var result, error, res;
    res = callWrapped(realFsClose, this, [fd, wrappedCallback]);
    result = res[0];
    error = res[1];

    if (error || result < 0) {
      zone.releaseCallback(wrappedCallback);
    }

    if (error) {
      throw error;
    } else {
      return result;
    }
  };

  // Operations targeting a file descriptor
  fs.fchmod = wrap(fs.fchmod, 'fs.fchmod', 2);
  fs.fchown = wrap(fs.fchown, 'fs.fchown', 3);
  fs.fdatasync = wrap(fs.fdatasync, 'fs.fdatasync', 1);
  fs.read = wrap(fs.read, 'fs.read', 5);
  fs.writeBuffer = wrap(fs.writeBuffer, 'fs.write', 5);
  fs.writeString = wrap(fs.writeString, 'fs.write', 4);
  fs.fstat = wrap(fs.fstat, 'fs.fstat', 1);
  fs.fsync = wrap(fs.fsync, 'fs.fsync', 1);
  fs.ftruncate = wrap(fs.ftruncate, 'fs.ftruncate', 2);
  fs.futimes = wrap(fs.futimes, 'fs.futimes', 3);

  // Operations targeting a path
  fs.stat = wrap(fs.stat, 'fs.stat', 1);
  fs.link = wrap(fs.link, 'fs.link', 2);
  fs.lstat = wrap(fs.lstat, 'fs.lstat', 1);
  fs.chmod = wrap(fs.chmod, 'fs.chmod', 2);
  fs.chown = wrap(fs.chown, 'fs.chown', 3);
  fs.rename = wrap(fs.rename, 'fs.rename', 2);
  fs.readlink = wrap(fs.readlink, 'fs.readlink', 1);
  fs.readdir = wrap(fs.readdir, 'fs.readdir', 1);
  fs.unlink = wrap(fs.unlink, 'fs.unlink', 1);
  fs.symlink = wrap(fs.symlink, 'fs.symlink', 3);
  fs.utimes = wrap(fs.utimes, 'fs.utimes', 3);

  //File operations can not be cancelled. Need to wait for them to finish.
  var noOpSignal = function() {};

  function wrap(method, methodName, callbackPos) {
    return function() {
      // Capture the original arguments and the callback.
      var args = new Array(arguments.length);
      for (var i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }
      var callback = args[callbackPos];

      // If the method is called synchronously, call the binding directly.
      if (typeof callback !== 'function') {
        return method.apply(this, args);
      }

      var wrappedCallback =
          zone.bindAsyncCallback(this, callback, null,
          {name: methodName, signalCallback: noOpSignal});
      args[callbackPos] = wrappedCallback;

      // The result of the method call.
      var error, result, res;
      res = callWrapped(method, this, args);
      result = res[0];
      error = res[1];

      if (error || result < 0) {
        zone.releaseCallback(wrappedCallback);
      }

      if (error) {
        throw error;
      } else {
        return result;
      }
    };
  }

  /**
   * Helper method to isolate try-catch from optimized code
   */
  function callWrapped(method, thisArg, args) {
    var error, result;
    try {
      result = method.apply(thisArg, args);
    } catch (err) {
      error = err;
    }
    return [result, error];
  }

  return fs;
};
