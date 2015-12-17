
module.exports = function(binding) {
  var Zone = zone.Zone;

  var constants = require('constants');
  var uid = require('../../uid.js');
  var util = require('util');

  var process_wrap = binding('process_wrap');
  patchPrototype(process_wrap.Process.prototype);

  function Process() { return (new process_wrap.Process()).__init__(); }

  return {Process: Process};

  function patchPrototype(prototype) {
    // Construction-time initialization
    prototype.__init__ = function() {
      this._zone = zone;
      this._id = uid();
      this._isRunning = false;

      return this;
    };

    // Spawn/Exit
    var realSpawn = prototype.spawn;

    Object.defineProperty(
        prototype, 'onexit',
        {
          get: getWrappedOnExitCallback,
          set: setOnExitCallback
        });

    function OnExit() {
      this._wrappedOnExitCallback.apply(this, arguments);
    }

    function getWrappedOnExitCallback() {
      return OnExit;
    }

    function setOnExitCallback(callback) {
      this._wrappedOnExitCallback =
          zone.bindAsyncCallback(this, callback, null, {name: 'Spawn.onExit'});
    }

    prototype.spawn = function(options) {
      if (this._isRunning) {
        throw new Error('Process is already running');
      }

      if (!options || typeof options !== 'object') {
        throw new TypeError('options is not an object');
      }

      zone._registerChild(this);
      this._file = options.file;
      this._killSignal = options.killSignal;
      this._isRunning = true;
      return realSpawn.apply(this, arguments);
    };

    // Close
    var realClose = prototype.close;
    prototype.close = function() {
      if (this._isRunning) {
        // Process#close doesn't take a callback.
        realClose.call(this);
        this._zone._unregisterChild(this);
        this._isRunning = false;
      }
    };

    // Cleanup
    prototype.signal = function(error) {
      if (!error) {
        return;
      }

      // Coerce the kill signal to a 32-bit integer.
      var killSignal = ~~this._killSignal;

      // Try to kill the process with the kill signal.
      if (killSignal && this.kill(killSignal) >= 0) return;

      // If the kill signal didn't work, try with SIGKILL.
      var r = this.kill(constants.SIGKILL);
    };


    // Cleanup
    prototype.release = function() { this.close(); };

    // Debugging
    prototype.dump = function(options) {
      var indent = options.indent || 0;
      var prefix = (new Array(indent + 1)).join('  ');
      var active = this._wrappedOnExitCallback ? '+' : ' ';

      var info;
      if (typeof this.pid === 'number')
        info = util.format(' (%s, pid: %d)', this._file, this.pid);
      else
        info = '';

      return util.format('%s%s[ChildProcess] #%d%s\n',
          prefix, active, this._id, info);
    };
  }
};
