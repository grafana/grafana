%nativeSource;

exports = module.exports;

var isv010 = require('../../isv010.js');

if (isv010) {
  // Monkey-patch the EventEmitter constructor.
  // This is the implementation for node v0.10.x; the node v0.11+
  // implementation is defined below.
  // In node 0.10 we replace the EventEmitter constructor is replaced in it's
  // entirety.
  var RealEventEmitter = exports.EventEmitter;

  exports.EventEmitter = function EventEmitter() {
    this._zone = zone;
    this._crossZone = true;
    this._zoneListeners = {};  // keeps a map of zone -> wrappedListener

    RealEventEmitter.apply(this, arguments);
  };

  exports.EventEmitter.prototype = RealEventEmitter.prototype;

} else {
  // Monkey-patch the EventEmitter constructor.
  // This is the implementation for node v0.11+; the node v0.10.x
  // implementation is defined above.
  // In node 0.11+ we the EventEmitter constructor is kept, because it is not
  // possible to replace whatever require('events') returns. However in this
  // version of node the EventEmitter constructor logic has moved to
  // EventEmitter.init(), so we can just monkey-patch that.
  var realEventEmitterInit = EventEmitter.init;

  /**
   * Initialize the event emitter and allow cross zone invocations.
   * @private
   */
  EventEmitter.init = function init() {
    this._zone = zone;
    this._crossZone = true;
    this._zoneListeners = {};  // keeps a map of zone -> wrappedListener

    return realEventEmitterInit.apply(this, arguments);
  };
}

EventEmitter.usingDomains = false;
EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;
EventEmitter.prototype._zone = undefined;
EventEmitter.prototype._crossZone = false;
EventEmitter.prototype._zoneListeners = {};

var realEventEmitterEmit = EventEmitter.prototype.emit;


/**
 * Perform zone check and emit events
 * @private
 */
EventEmitter.prototype.emit = function emit() {
  zoneCheck(this);
  return this._zone.apply(this, realEventEmitterEmit, arguments);
};

var realEventEmitterAddListener = EventEmitter.prototype.addListener;


/**
 * Bind the listener to the current zone and register it with the event emitter
 * @private
 */
var addListener = function(event, listener) {
  zoneCheck(this);
  listener = wrapListener(this, event, listener);
  return realEventEmitterAddListener.call(this, event, listener);
};
EventEmitter.prototype.addListener = addListener;
EventEmitter.prototype.on = EventEmitter.prototype.addListener;

var realEventEmitterRemoveListener = EventEmitter.prototype.removeListener;
EventEmitter.prototype.removeListener = function(event, listener) {
  zoneCheck(this);
  var wrappedListenerFunc = findListener(this, event, listener);
  if (wrappedListenerFunc) {
    var result =
        realEventEmitterRemoveListener.call(this, event, wrappedListenerFunc);
    releaseListener(wrappedListenerFunc);
  }
  return;
};

var realEventEmitterListeners = EventEmitter.prototype.listeners;
EventEmitter.prototype.listeners = function(event) {
  var events = this._events;
  var list = events[event];
  if (typeof list === 'function') {
    return [list._listener];
  } else if (list) {
    var result = [];
    var length = list.length;
    for (var i = 0; i < length; i++) {
      result.push(list[i]._listener);
    }
    return result;
  } else {
    return [];
  }
};

var listenerId = 0;
function wrapListener(emitter, event, listener) {
  // maintain a list of zone->listeners association so we can clean them
  // up if we receive a signal later
  if (!emitter._zoneListeners[zone.id]) {
    emitter._zoneListeners[zone.id] = {};
  }

  // Id allows us to easily identify the corresponding wrapped listener
  listener._zone = zone;

  var signalCallback = function(err) {
    removeAllZoneListeners(emitter, this._destZone);
  };

  // during cleanup, will need a handle to the emitter so we can push
  // remaining events
  var wrappedListenerFunc =
      zone.bindCallback(this, listener, emitter._zone,
                        { autoRelease: false,
                          name: 'Event listener',
                          signalCallback: signalCallback
                        });
  wrappedListenerFunc._emitter = emitter;
  wrappedListenerFunc._event = event;
  wrappedListenerFunc._listener = listener;
  wrappedListenerFunc._id = ++listenerId;

  emitter._zoneListeners[zone.id][wrappedListenerFunc._id] =
      wrappedListenerFunc;

  return wrappedListenerFunc;
}


/**
 * Given an event and user provided (unwrapped) listener, find the wrapped
 * listener associated with it.
 * @private
 */
function findListener(emitter, event, listener) {
  var events = emitter._events;
  var list = events[event];
  if (typeof list === 'function') {
    if (list._listener === listener) {
      return list;
    } else {
      return null;
    }
  } else if (list) {
    var length = list.length;
    for (var i = 0; i < length; i++) {
      if (list[i]._listener === listener) {
        return list[i];
      }
    }
  }
  return null;
}


/**
 * Cleanup references to a single listener
 * @private
 */
function releaseListener(wrapListener) {
  var emitter = wrapListener._emitter;
  var originalListener = wrapListener._listener;

  // cleanup listeners
  zone.releaseCallback(wrapListener);
  if (emitter._zoneListeners[originalListener._zone.id]) {
    delete emitter._zoneListeners[originalListener._zone.id][wrapListener._id];
    if (Object.keys(emitter._zoneListeners[originalListener._zone.id])
            .length === 0) {
      delete emitter._zoneListeners[originalListener._zone.id];
    }
  }
}


/**
 * Given a zone, find all listeners associated with that zone and remove them
 * This is used to clean up all listeners when once of the listeners is
 * signaled to exit
 * @private
 */
function removeAllZoneListeners(emitter, zone) {
  var list = emitter._zoneListeners[zone.id];
  if (list) {
    var keys = Object.keys(list);
    var len = keys.length;
    for (var i = 0; i < len; ++i) {
      var wrappedListenerFunc = list[keys[i]];
      var result = realEventEmitterRemoveListener.call(
          emitter, wrappedListenerFunc._event, wrappedListenerFunc);
      releaseListener(wrappedListenerFunc);
    }
  }
}


/**
 * Ensure that emitter zone is initialized properly
 * @private
 */
function zoneCheck(emitter) {
  if (emitter._zone && emitter._crossZone) {
    // Normal case: this EventEmitter was initialized in the constructor, hence
    // can be used across multiple zones. Check if the active zone is the same
    // or a child zone of the constructor zone.
    if (zone !== emitter._zone && !zone.childOf(emitter._zone))
      throw new Error(
          'Only the zone in which the event emitter was creates ' +
          "and it's child zone can interact with this EventEmitter.");

  } else if (emitter._zone && !emitter._crossZone) {
    // Compatibility: sometimes libraries inherit from EventEmitter but they
    // omit calling the EventEmitter constructor from the subclass constructor.
    // In these cases we can't capture the construction zone so we disallow
    // using the EventEmitter across zones.
    if (zone !== emitter._zone)
      throw new Error('Only one zone can interact with this EventEmitter but' +
                      " you're not in it. You can win more freedom by " +
                      'calling the EventEmitter() constructor properly.');

  } else {
    // See the previous case. This EventEmitter is used for the first time, so
    // lazily capture the zone but clear the _crossZone flag.
    emitter._zone = zone;
  }
}
