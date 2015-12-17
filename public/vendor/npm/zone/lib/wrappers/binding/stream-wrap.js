
/*
# Handle objects
- A js object representing a resource tied to a c++ object
- Must be explicitly closed by calling .close() (except for FSEventWrap which is GCed - but that's unrelated to streams)
- The handle object may have a close callback (on the `onclose` property), which is optional. Node mostly doesn't use it.
- A handle keeps a zone alive when it is autonomously active (reading or listening) and not unref'ed.
- There are distinct types (tcp, pipe, tty) which have more or less the same interface.
- Handles may exist before their underlying resource exists!

# Some ordinary asynchronous methods:
- Asynchronous methods return (in v0.10) or use (0.11+) a 'request' object.
- A pending asynchronous method keep a zone alive
- The 'oncomplete' property should be a assigned a function, it will be called when the asynchronous operation is complete.
- Success / error is either returned as a status code (node 0.11+) or (0.10) as an object/null (with any error reported by process._errno)
- The methods:
  - connect
  - connect6
  - shutdown
  - ...

# Some "states"
- Do not use request objects
- Handles trigger related callbacks independently
- The states:
  - reading (controlled by read_start and read_stop, callback at `onread`)
  - accepting connections (controlled by `listen`, callback at `onconnection`)

# Write methods
Write methods are like asynchronous methods, but also magical in several ways:
  - may be synchronous in node 0.11 (!!) - check the req.async property to figure it out
  - There are several (writeAsciiString, writeUtf8String, writeBuffer, writeUCS2String, writev)
  - dispatching is affected by cork/uncork (in node 0.11)
  - In the high-level interface, .write() and .end() take an optional callback, which have different
    semantics than node's ordinary error-first callback scheme! We must ensure that whenever the user
    specifies these callbacks, they are called in the right zone-context.

# Synchronous methods
  - Synchronous methods are not all that interesting of course
  - Except that there are edge cases
    - stdin/out/err are constructed lazily, and non-closable. They must always be registered to the root zone
    - ...

# Considerations for monkey-patching at the binding level
  - neither stateful callbacks (onread, onconnection, onclose), nor request callbacks are tied
    1:1 to the callback that the user passes to the high-level streams interface.
    This is also true for .end([data], [cb]), .write(data, [cb])

# Monkey patching strategy
  - A handle is registered to a zone when it is created (but doesn't ref it)
  - A handle is unregistered from a zone when the close callback is called
  - A handle refs a zone when it starts reading or listening (unless it is unref'ed)
  - A handle unrefs a zone when it stops reading or listenening (unless it is unref'ed)
  - A handle refs a zone when .close() is called

# Performance options
  - Can we assume that when .onread, .oncomplete etc are assigned, they will not change?
  - Can we assume that the binding-level callbacks can always be made in the handle's owner zone
    (we would need to rely on the eventemitter zone logic, and patch some methods at the lib layer (.connect, .write, .end, .close)
  - Can we re-use Callback objects?

# Signaling behaviour
  - Requests can't be canceled; we'll just wait for them to complete.
  - Handles will stop reading / stop accepting connections when signaled.
  - Handles will be closed when signaled.

# Close behaviour
  - The lib layer needs to know when a handle is closed, or it's internal state will be messed up.

Monkey patching a request method

*/

// FIXME long lines
module.exports = function(binding) {
  var isv010 = require('../../isv010.js');

  var pipe_wrap = binding('pipe_wrap');
  var tcp_wrap = binding('tcp_wrap');
  var tty_wrap = binding('tty_wrap');

  patchPrototype(pipe_wrap.Pipe.prototype);
  patchPrototype(tcp_wrap.TCP.prototype);
  patchPrototype(tty_wrap.TTY.prototype);

  function Pipe() { return (new pipe_wrap.Pipe()).__init__(); }

  function TCP() { return (new tcp_wrap.TCP()).__init__(); }

  function TTY(fd, readable) {
    return (new tty_wrap.TTY(fd, readable)).__init__(fd);
  }

  return {
    isTTY: tty_wrap.isTTY,
    guessHandleType: tty_wrap.guessHandleType,
    Pipe: Pipe,
    TCP: TCP,
    TTY: TTY
  };

  function patchPrototype(prototype) {
    prototype.__init__ = function __init__(fd) {
      this.__fd__ = fd;

      // Lazily created stdio handles are to be created in the root zone.
      this.__zone__ = global.zone;

      /**
       * A pointer to the previous sibling zone or delegate within the
       * parent zone
       * @ private
       */
      this._previousSibling = null;

      /**
       * A pointer to the next sibling zone or delegate within the parent
       * zone
       * @ private
       */
      this._nextSibling = null;

      this._released = false;

      this.__active__ = false;
      this.__closing__ = false;
      this.__ref__ = true;

      this.__zone__._registerChild(this);
      return this;
    };


    monkeypatchAsyncMethod(prototype, 'connect');
    monkeypatchAsyncMethod(prototype, 'connect6');
    monkeypatchAsyncMethod(prototype, 'shutdown');
    monkeypatchAsyncMethod(prototype, 'writeAsciiString');
    monkeypatchAsyncMethod(prototype, 'writeBuffer');
    monkeypatchAsyncMethod(prototype, 'writeUcs2String');
    monkeypatchAsyncMethod(prototype, 'writeUtf8String');

    function monkeypatchAsyncMethod(prototype, methodName) {
      // Capture the original method
      var originalMethod = prototype[methodName];

      // If the original method doesn't exist, the handle type doesn't support this interface,
      // so we don't have to monkey patch.
      if (!originalMethod)
        return;

      if (isv010) {
        // Replace the method by a wrapper. This is the node v0.10 version,
        // the node v0.11+ version is defined below.
        prototype[methodName] = function(/* ... */) {
          // Call the original method.
          var req = originalMethod.apply(this, arguments);

          // On failure, no callback will be made, so we don't have to register anything with the zone.
          if (!req)
            return req;

          // The binding layer will read the .oncomplete property when the async method completes.
          // We must ensure that it will see our wrapper instead.
          req.__defineGetter__('oncomplete', getBindingOnCompleteCallback);

          // When the user assigns .oncomplete (which may happen in the future!) we must capture
          // the callback and make sure `restoreZoneAndCallOnComplete` can access it.
          req.__defineSetter__('oncomplete', captureUserOnCompleteCallback);

          // Capture the completion zone, so `restoreZoneAndCallUserOnCompleteCallback` knows what zone to restore.
          req.__zone__ = global.zone; // Or this.__zone__ might also work?

          // Increment the zone reference count.
          req.__zone__._incrementScheduledTaskCount();

          return req;
        };
      } else {
        // Replace the method by a wrapper. This is the node v0.11+ version,
        // the node v0.10 version is defined above.
        prototype[methodName] = function(req /*, ... */) {
          // If the user already assigned an oncomplete callback, copy it to another property.
          req.__user_oncomplete__ = req.oncomplete;

          // The binding layer will read the .oncomplete property when the async method completes.
          // We must ensure that it will see our wrapper instead.
          req.__defineGetter__('oncomplete', getBindingOnCompleteCallback);

          // When the user assigns .oncomplete (which may happen in the future!) we must capture
          // the callback and make sure `restoreZoneAndCallOnComplete` can access it.
          req.__defineSetter__('oncomplete', captureUserOnCompleteCallback);

          // Capture the completion zone, so `restoreZoneAndCallUserOnCompleteCallback` knows what zone to restore.
          req.__zone__ = global.zone; // Or this.__zone__ might also work?

          // Call the original method.
          // Assume that the binding layer never throws (I am not aware of any cases where it would, but not completely sure).
          var result = originalMethod.apply(this, arguments);

          // On failure, no callback will be made, so we don't have to register anything with the zone.
          if (result < 0)
            return result;

          // Write methods only: on synchronous completion no callback will be made either.
          // This check may be expensive for non-write requests because the `async` property doesn't exist
          // in the hidden class.
          if (req.async === false)
            return result;

          // Increment the zone reference count.
          req.__zone__._incrementScheduledTaskCount();
        };
      }
    }

    function captureUserOnCompleteCallback(callback) {
      this.__user_oncomplete__ = callback;
    }

    function getBindingOnCompleteCallback() {
      return restoreZoneAndCallUserOnCompleteCallback;
    }

    function restoreZoneAndCallUserOnCompleteCallback(/*...*/) {
      var oncomplete = this.__user_oncomplete__;
      var callbackZone = this.__zone__;

      // Call/schedule the callback and un-register from the zone.
      callbackZone.apply(this, oncomplete, arguments); // Or something like that

      // Decrement the zone reference count or unregister something.
      this.__zone__._decrementScheduledTaskCount();
    }

    var originalReadStart = prototype.readStart;
    var originalReadStop = prototype.readStop;

    prototype.__defineSetter__('onread', captureUserOnReadCallback);
    prototype.__defineGetter__('onread', getBindingOnReadCallback);

    prototype.readStart = function() {
      // This is a no-op when the handle is already reading.
      if (this.__active__) {
        return;
      }

      // Call the original readStart method.
      var result = originalReadStart.apply(this, arguments); // Probably there are no arguments.
      if (result < 0) {
        return;
      }

      this.__active__ = true;

      // Only increment the reference count if the handle is ref'ed.
      if (this.__ref__) {
        this.__zone__._incrementScheduledTaskCount(); // Or something.
      }
    };

    prototype.readStop = function() {
      // This is the no-op if the handle isn't reading.
      if (!this.__active__) {
        return;
      }

      // Call the original readStop method; it takes no arguments.
      // TODO: check that readStop takes effect immediately. Questionable.
      var result = originalReadStop.apply(this, arguments);
      if (result < 0) {
        return;
      }

      this.__active__ = false;

      // Only decrement the reference count if the handle is ref'ed.
      if (this.__ref__) {
        this.__zone__._decrementScheduledTaskCount();
      }
    };

    function captureUserOnReadCallback(callback) {
      // Store the user-specified onread callback, but use a different property name.
      this.__user_onread__ = callback;
    }

    function getBindingOnReadCallback() {
      // Return the callback that the binding layer sees when it tries to make a callback.
      return restoreZoneAndCallUserOnReadCallback;
    }

    function restoreZoneAndCallUserOnReadCallback(/*...*/) {
      var onread = this.__user_onread__;
      var callbackZone = this.__zone__;
      // Call/schedule the callback in the proper zone.
      callbackZone.apply(this, onread, arguments); // Or something like that
    }


    // Listen, in similar vein. There is no way to stop listening.

    var originalListen = prototype.listen;

    prototype.__defineSetter__('onconnection', captureUserOnConnectionCallback);
    prototype.__defineGetter__('onconnection', getBindingOnConnectionCallback);

    prototype.listen = function() {
      // This is a no-op when the handle is already listening.
      if (this.__active__)
        return;

      // Call the original listen method.
      var result = originalListen.apply(this, arguments); // Probably there are no arguments.
      if (result < 0)
        return;

      this.__active__ = true;

      // Only increment the reference count if the handle is ref'ed.
      if (this.__ref__) {
        this.__zone__._incrementScheduledTaskCount(); // Or something.
      }
    };

    function captureUserOnConnectionCallback(callback) {
      // Store the user-specified onread callback, but use a different property name.
      this.__user_onconnection__ = callback;
    }

    var restoreZoneAndCallUserOnConnectionCallback;

    if (isv010) {
      // Accept the incoming connection and initialize the handle to be
      // zone-aware. This is the node v0.10 version, the node v0.11+ version
      // is defined below.
      restoreZoneAndCallUserOnConnectionCallback =
          function restoreZoneAndCallUserOnConnectionCallback(clientHandle) {
        var onconnection = this.__user_onconnection__;
        var callbackZone = this.__zone__;

        // Associate the accepted handle with the same zone as the server.
        if (clientHandle) {
          var curZone = global.zone;
          global.zone = this.__zone__;
          clientHandle.__init__();
          global.zone = curZone;
        }

        // Call/schedule the callback in the proper zone.
        callbackZone.apply(this, onconnection, arguments);
      };

    } else {
      // Accept the incoming connection and initialize the handle to be
      // zone-aware. This is the node v0.11+ version, the node v0.10 version
      // is defined above.
      restoreZoneAndCallUserOnConnectionCallback =
          function restoreZoneAndCallUserOnConnectionCallback(err, clientHandle) {
        var onconnection = this.__user_onconnection__;
        var callbackZone = this.__zone__;

        // Associate the accepted handle with the same zone as the server.
        if (clientHandle) {
          var curZone = global.zone;
          global.zone = this.__zone__;
          clientHandle.__init__();
          global.zone = curZone;
        }

        // Call/schedule the callback in the proper zone.
        callbackZone.apply(this, onconnection, arguments);
      };
    }

    function getBindingOnConnectionCallback() {
      // Return the callback that the binding layer sees when it tries to make a callback.
      return restoreZoneAndCallUserOnConnectionCallback;
    }

    // Open
    var originalOpen = prototype.open;

    prototype.open = function(fd) {
      var result = originalOpen.call(this, fd);
      this.__fd__ = fd;
    };


    // Ref/unref
    var originalRef = prototype.ref;
    var originalUnref = prototype.unref;

    prototype.ref = function() {
      if (this.__ref__ || this.__closing__) {
        return;
      }

      if (this.__active__) {
        this.__zone__._incrementScheduledTaskCount();
      }

      originalRef.call(this);

      this.__ref__ = true;
    };

    prototype.unref = function() {
      if (!this.__ref__ || this.__closing__) {
        return;
      }

      if (this.__active__) {
        this.__zone__._decrementScheduledTaskCount();
      }

      originalUnref.call(this);

      this.__ref__ = false;
    };

    var originalClose = prototype.close;

    prototype.close = function(cb) {
      if (this.__closing__) {
        return;
      }

      if (!this.__ref__ || !this.__active__) {
        this.__zone__._incrementScheduledTaskCount();
      }

      this.__closing__ = true;
      this.__user_onclose__ = cb;

      originalClose.call(this, onClose);
    };

    function onClose() {
      if (this.__user_onclose__) {
        // Use .call here because v8 may not be able to detect the
        // .apply(this, arguments) pattern here, and the close callback doesn't
        // take any arguments anyway.
        this.__zone__.apply(this, this.__user_onclose__);
      }

      this.__zone__._decrementScheduledTaskCount();
      this.release();
    }

   // Cleanup
    prototype.signal = function signal(error) {
      // Of course we could use the handle's close() method here, but then the
      // lib wrappers would never know about it. Therefore the close call is
      // routed through the lib wrapper. This must be either a net.Server that
      // exposes .close(), or a net.Socket that exposes .destroy().
      // However don't try to close stdio handles because they throw.
      var owner = this.owner;

      if (this.__closing__) {
        // Do nothing if the stream or server is already closing.
        return;
      } else if (this.__fd__ >= 0 && this.__fd__ <= 2) {
        // STD in/out/err streams. Just mark them released
        this.release();
      } else {
        if (!owner) {
          // This should never happen, but node v0.10 has a bug (#8504) that
          // necessitates it.
          this.close();
        } else if (owner.close) {
          owner.close();
        } else if (owner.writable && owner.destroySoon) {
          owner.destroySoon();
        } else {
          owner.destroy();
        }
      }
    };

    prototype.release = function release() {
      if (this.__released)
        return;

      this.__released = true;
      this.__zone__._unregisterChild(this);
    };

    prototype.dump = function dump(options) {
      var indent = options.indent || 0;
      var prefix = (new Array(indent + 1)).join('  ');

      var type;
      if (this.__user_onconnection__) {
        type = this.constructor.name + ' server';
      }else if (this.constructor !== TCP) {
        type = this.constructor.name + ' handle';
      }else {
        type = 'TCP socket';
      }

      if (this.__closing__) {
        console.log(util.format('%s [%s] in zone %s is already closed\n',
          prefix, 'Stream      ', type, this.__zone__.name));
        return;
      }

      var sockName = {};
      if (this.getsockname && !this.__closing__)
        this.getsockname(sockName);

      var peerName = {};
      if (this.getpeername && !this.__closing__)
        this.getpeername(peerName);

      var address = '';
      if (sockName.address) {
        address += sockName.address + ':' + sockName.port;
      }
      if (peerName.address) {
        address += ' <=> ' + peerName.address + ':' + peerName.port;
      }
      if (this.__fd__ !== null) {
        address += (address && ', ') + 'fd: ' + this.__fd__;
      }
      if (address) {
        address = ' (' + address + ')';
      }

      return util.format('%s [%s] %s %s\n',
          prefix, 'Stream      ', type, address);
    };
  }
};
