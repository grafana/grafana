var assert = require('assert');
var uid = require('./uid.js');
var scheduler = require('./scheduler.js');
var NonError = require('./non-error.js');
var ZoneCallback = require('./zone-callback.js');
var util = require('util');

function Zone(functionBody, options) {
  assert(typeof functionBody === 'function' ||
         (options && options.isConstructingRootZone));

  /**
   * Ensure that this is a new Zone instance and not called as function.
   * Simple instanceof checks don't work, because we want to detect when Zone
   * is called as a method of a zone:
   *    zone.Zone(...)
   * which fools the instance check, because the receiver is an instance of
   * Zone, but not a new zone. For new zones, its an instanceof Zone AND it
   * does not yet have it's own 'id' property.
   */
  assert((this instanceof Zone) && !this.hasOwnProperty('id'));

  if (!options) {
    options = {};
  }

  /**
   * True if this is the root zone.
   * @private
   */
  this._isRoot = false;

  var name;
  if (options.isConstructingRootZone) {
    name = 'Root';
    this._isRoot = true;
  } else if (options.name) {
    name = options.name;
  } else if (functionBody.name) {
    name = functionBody.name;
  } else {
    name = 'Anonymous';
  }

  /**
   * Zone name. The root zone is named `'Root'`. New zones can be named by
   * setting the `name` option while creating the Zone. If the name is not
   * provided, it will use the name of the function if available or default
   * to 'Anonymous'.
   */
  this.name = name;

  /**
   * Numeric Zone ID which is unique to each Zone.
   */
  this.id = uid();

  if (this._isRoot) {
    this.parent = null;
    this.root = this;
  } else {
    assert(zone);
    this.parent = zone;
    this.root = zone.root;
  }

  if (this._isRoot) {
    /**
     * User data stored with this Zone
     */
    this.data = global;
  } else {
    this.data = Object.create(this.parent.data);
  }

  /**
   * Keeps track of the number of callbacks that have been scheduled using
   * ```scheduler.enqueueCallback``` or potential callbacks that will be made
   * from by I/O operations (```ZoneCallback``` objects with a source zone of
   * null)
   *
   * If not already exiting due to ```Zone.return(...)``` or
   * ```Zone.throw(...)```, this Zone must wait for these callbacks before it
   * can be finalized.
   *
   * @type {number}
   * @private
   */
  this._numScheduledTasks = 0;

  /**
   * When finalizing a zone, this stores the most recently signaled child
   * @private
   */
  this._lastSignaledChild = null;

  /**
   * Pointer to linked list of children of this zone added using
   * ```Zone._registerChild(...)```
   * @private
   */
  this._lastChild = null;

  /**
   * Pointer to linked list of child ZoneCallback objects added using
   * ```Zone._registerZoneCallback(...)```. This zone is the target zone of all
   * callbacks in the list.
   *
   * @private
   */
  this._lastZoneCallback = null;

  /**
   * Before a function invoked within the zone, this hook runs.
   * @private
   */
  this._beforeTask = null;
  if (options && options.beforeTask &&
      typeof options.beforeTask === 'function') {
    this._beforeTask = options.beforeTask;
  }

  /**
   * After a function invoked within the zone, this hook runs.
   * @private
   */
  this._afterTask = null;
  if (options && options.afterTask && typeof options.afterTask === 'function') {
    this._afterTask = options.afterTask;
  }

  /**
   * Number of ZoneCallback which can be triggered from a parent zone.
   *
   * If not already exiting due to ```Zone.return(...)``` or
   * ```Zone.throw(...)```, this Zone must wait for these callbacks before it
   * can be finalized.
   *
   * @type {number}
   * @private
   */
  this._numNonLocalZoneCallbacks = 0;

  /**
   * Pointer to linked list of ZoneCallback objects added using
   * ```Zone._registerCallbackConsumer(...)```. This zone is the source zone of
   * all callbacks in the list.
   *
   * @private
   */
  this._lastCallbackConsumer = null;

  /**
   * If true then the zone has been scheduled for cleanup.
   * @private
   */
  this._finalizerScheduled = false;

  /**
   * Set after finalizer has completed running
   * @private
   */
  this._closed = false;

  /**
   * Set to indicate the Zone is exiting due to an error or result.
   * @private
   */
  this._exiting = false;

  /**
   * Stores an error that is caused in this zone or propogated from parent or
   * child.
   * @private
   */
  this._error = null;

  /**
   * Stores the result value for this zone.
   * @private
   */
  this._result = undefined;

  /**
   * This function is called first when an error is encountered.
   * Callback registered using constructor or setCallback().
   * @private
   */
  this._errorFirstCallback = null;

  /**
   * This function is called upon returning from the zone succesfully.
   * Callback registered using zone.then(...)
   * @private
   */
  this._successCallback = null;

  /**
   * This function is called upon returning from the zone with an error
   * provided no _errorFirstCallback is set. Callback registered using
   * zone.then(...)
   * @private
   */
  this._errorCallback = null;

  /**
   * The HTTP agent and the HTTP client are so intertwined that it is not
   * practical to share them between zones. See wrappers/node-lib/_http_agent.js
   * @private
   */
  this._httpAgent = null;

  /**
   * A pointer to the previous sibling (linked list)
   * @private
   */
  this._previousSibling = null;

  /**
   * A pointer to the next sibling (linked list)
   * @private
   */
  this._nextSibling = null;

  if (Zone.longStackSupport) {
    Error.captureStackTrace(this, Zone);
  }

  if (options && options.callback) {
    this.setCallback(options.callback);
  }
  if (options) {
    this.then(options.successCallback, options.errorCallback);
  }

  if (!this._isRoot) {
    this.parent._registerChild(this);
    this._run(functionBody);
    this.enqueueFinalize();
  }
}


/**
 * Creates a new Zone as a child of the current Zone and run the function body
 * within it.
 *
 * @param {function} functionBody The function to be wrapped and run within the
 *                                Zone.
 * @options {object} [Options]
 * @prop {string} [name] The name of the zone. Defaults to name of wrapped
 *                       function.
 * @prop {Zone~beforeTask} [beforeTask] Before a function invoked within the
 *                                      zone, this hook runs.
 * @prop {Zone~afterTask} [afterTask] After a function in a zone runs, the
 *                                    afterTask hook runs.
 * @prop {Zone~Callback} [callback] Callback which is called with
 *                                  errors or results when the zone exits.
 *                                  Callback runs in parent of created zone.
 * @prop {Zone~OnSuccess} [successCallback] Callback which is called with
 *                                          results when the zone exits without
 *                                          error. Callback runs in parent of
 *                                          created zone.
 * @prop {Zone~OnFailure} [errorCallback] Callback which is called with
 *                                        error when the zone exits. Callback
 *                                        runs in parent of created zone.
 * @end
 * @param {Zone~Callback} [callback] Callback which is called with
 *                                   errors or results when the zone exits.
 * @return {Zone} Zone.
 */
Zone.prototype.create = function create(functionBody, options, callback) {
  options = _parseZoneOptions(options, callback);
  return new Zone(functionBody, options);
};


/**
 * Utility method to create a reusable function which will run create a new Zone
 * and run within it.
 *
 * @param {function} functionBody The function to be wrapped and run within the
 *                                Zone.
 * @options {object} [Options]
 * @prop {string} [name] The name of the zone. Defaults to name of wrapped
 *                       function.
 * @prop {Zone~beforeTask} [beforeTask] Before a function invoked within the
 *                                      zone, this hook runs. If zone.beforeTask
 *                                      throws, the function passed to run will
 *                                      not be invoked.
 * @prop {Zone~afterTask} [afterTask] After a function in a zone runs, the
 *                                    afterTask hook runs. This hook will run
 *                                    even if the function passed to run throws.
 * @prop {Zone~Callback} [callback] Callback which is called with
 *                                  errors or results when the zone exits.
 *                                  Callback runs in parent of created zone.
 * @prop {Zone~OnSuccess} [successCallback] Callback which is called with
 *                                          results when the zone exits without
 *                                          error. Callback runs in parent of
 *                                          created zone.
 * @prop {Zone~OnFailure} [errorCallback] Callback which is called with
 *                                        error when the zone exits. Callback
 *                                        runs in parent of created zone.
 * @end
 * @param {Zone~Callback} [callback] Callback which is called with
 *                                   errors or results when the zone exits.
 * @return {Zone} Zone.
 */
Zone.prototype.define = function define(functionBody, options, callback) {
  options = _parseZoneOptions(options, callback);
  var functionName = functionBody.name;
  if (!options.hasOwnProperty('name')) {
    options.name = functionName;
  }

  return function defineZone() {
    var args = arguments;

    function wrappedBody() { return functionBody.apply(this, args); }

    var z = new Zone(wrappedBody, options);
    return z;
  };
};


/**
 * Check if the provided zone is a parent of the current zone.
 * @param {Zone} checkParent Potential parent zone.
 * @return {bool}
 */
Zone.prototype.childOf = function childOf(checkParent) {
  assert(checkParent instanceof Zone);

  var z = this;
  do {
    if (z === checkParent) {
      return true;
    }
    z = z.parent;
  } while (z);

  return false;
};


/**
 * Set the callback function which is invoked with errors or results when the
 * zone exits. This is an alternative to passing the callback during Zone
 * creation.
 *
 * @param {Zone~Callback} cb
 * @throws {TypeError} Callback is not a function
 * @throws {Error} Callback has already been set earlier
 * @return {Zone} this Zone.
 */
Zone.prototype.setCallback = function setCallback(cb) {
  if (cb !== null) {
    if (typeof cb !== 'function')
      throw new TypeError('callback is not a function');

    if (this._errorFirstCallback || this._successCallback ||
        this._errorCallback)
      throw new Error('Callback already set');

    this._errorFirstCallback = cb;
  }

  return this;
};


/**
 * When an the Zone exits due to an error or completion, it calls one of the
 * success or error callbacks asynchronously with a single argument: the result
 * or error reason.
 *
 * These callbacks can not be set one has already been set using
 * ```Zone.setCallback```.
 *
 * @param {function} successCB
 * @param {function} errorCB
 * @throws {TypeError} Callback is not a function
 * @throws {Error} Callback has already been set earlier
 * @return {Zone} this Zone.
 */
Zone.prototype.then = function then(successCB, errorCB) {
  if (successCB) {
    if (typeof successCB !== 'function')
      throw new TypeError('callback is not a function');

    if (this._errorFirstCallback || this._successCallback)
      throw new Error('Callback already set');

    this._successCallback = successCB;
  }

  if (errorCB) {
    if (typeof errorCB !== 'function')
      throw new TypeError('callback is not a function');

    if (this._errorFirstCallback || this._errorCallback)
      throw new Error('Callback already set');

    this._errorCallback = errorCB;
  }

  return this;
};


/**
 * Alias for ```zone.then(null, errorCallback)```
 *
 * @param {function} errorCB
 * @throws {TypeError} Callback is not a function
 * @throws {Error} Callback has already been set earlier
 * @return {Zone} this Zone.
 */
Zone.prototype.catch = function(errorCB) {
  this.then(null, errorCB);
  return this;
};

/*
 * Register a child with this Zone
 * @param {Object} child Zone child (Must provide ```signal(err)```,
 *                 ```release()``` and ```dump(options)``` methods)
 * @private
 */
Zone.prototype._registerChild = function _registerChild(child) {
  assert(typeof child.signal === 'function' &&
         typeof child.release === 'function' &&
         typeof child.dump === 'function');

  // update child linked list
  if (this._lastChild) {
    this._lastChild._nextSibling = child;
  }
  child._previousSibling = this._lastChild;
  this._lastChild = child;
};

/*
 * Register a local ZoneCallback with this Zone.
 * Maintains ```this._numNonLocalZoneCallbacks```.
 *
 * @param {ZoneCallback} child
 * @private
 */
Zone.prototype._registerZoneCallback = function _registerZoneCallback(child) {
  assert(typeof child.signal === 'function' &&
         typeof child.release === 'function' &&
         typeof child.dump === 'function');

  // update child linked list
  if (this._lastZoneCallback) {
    this._lastZoneCallback._nextSibling = child;
  }
  child._previousSibling = this._lastZoneCallback;
  this._lastZoneCallback = child;
  if (child._sourceZone !== this) {
    ++this._numNonLocalZoneCallbacks;
  }
};

/*
 * Unregister a child from this Zone. Triggers ```enqueueFinalize``` if the last
 * child is removed or Zone is already exiting.
 *
 * @param {Object} child Zone child (Must provide ```signal(err)```,
 *                 ```release()``` and ```dump(options)``` methods)
 * @private
 */
Zone.prototype._unregisterChild = function _unregisterChild(child) {

  // update child linked list
  if (child._previousSibling) {
    child._previousSibling._nextSibling = child._nextSibling;
  }
  if (child._nextSibling) {
    child._nextSibling._previousSibling = child._previousSibling;
  }
  if (this._lastChild === child) {
    this._lastChild = child._previousSibling;
  }
  if (this._exiting || !this._lastChild) {
    this.enqueueFinalize();
  }
};

/*
 * Unregister a local ZoneCallback from this Zone.
 * Maintains ```this._numNonLocalZoneCallbacks```.
 *
 * @param {ZoneCallback} cb
 * @private
 */
Zone.prototype._unregisterZoneCallback = function _unregisterZoneCallback(cb) {
  // update child linked list
  if (cb._previousSibling) {
    cb._previousSibling._nextSibling = cb._nextSibling;
  }
  if (cb._nextSibling) {
    cb._nextSibling._previousSibling = cb._previousSibling;
  }
  if (this._lastZoneCallback === cb) {
    this._lastZoneCallback = cb._previousSibling;
  }
  if (cb._sourceZone !== this) {
    --this._numNonLocalZoneCallbacks;
    if (this._numNonLocalZoneCallbacks === 0) {
      this.enqueueFinalize();
    }
  }
};

/*
 * Register a non-local ZoneCallback for which this zone is the source.
 * When a Zone is being finalizing, these objects will be released so that the
 * target zone of these callbacks may clean itself up.
 *
 * @param {ZoneCallback} child
 * @private
 */
Zone.prototype._registerCBConsumer = function _registerCBConsumer(child) {
  // update child linked list
  if (this._lastCallbackConsumer) {
    this._lastCallbackConsumer._nextCBConsumer = child;
  }
  child._previousCBConsumer = this._lastCallbackConsumer;
  this._lastCallbackConsumer = child;
};

/*
 * Unregister a non-local ZoneCallback for which this zone is the source.
 *
 * @param {ZoneCallback} child
 * @private
 */
Zone.prototype._unregisterCBConsumer = function _unregisterCBConsumer(child) {
  // update child linked list
  if (child._previousCBConsumer) {
    child._previousCBConsumer._nextCBConsumer = child._nextCBConsumer;
  }
  if (child._nextCBConsumer) {
    child._nextCBConsumer._previousCBConsumer = child._previousCBConsumer;
  }
  if (this._lastCallbackConsumer === child) {
    this._lastCallbackConsumer = child._previousCBConsumer;
  }
};


/**
 * Increment the ```Zone._numScheduledTasks``` count on this and all parent
 * zones
 *
 * @private
 */
Zone.prototype._incrementScheduledTaskCount = function() {
  var z = this;
  while (z !== null) {
    ++z._numScheduledTasks;
    z = z.parent;
  }
};


/**
 * Decrement the ```Zone._numScheduledTasks``` count on this and all parent
 * zones. Triggers ```Zone.enqueueFinalize()``` if count reaches 0.
 *
 * @private
 */
Zone.prototype._decrementScheduledTaskCount = function() {
  var z = this;
  while (z !== null) {
    --z._numScheduledTasks;
    z = z.parent;
  }
  if (this._numScheduledTasks === 0) {
    this.enqueueFinalize();
  }
};


/**
 * Helper function to isolate try/catch for optimization.
 * If an error is caught, it invokes ```Zone.throw``` to handle the error.
 *
 * @private
 * @return {*} result of the call or null on error.
 */
Zone.prototype._apply = function _apply(thisArg, fn, args) {
  try {
    return fn.apply(thisArg, args);
  } catch (err) {
    this.throw(err);
    return null;
  }
};


/**
 * The apply() method calls a function with a given this value and arguments
 * provided as an array within this Zone.
 *
 * @param {object} thisArg The value of this provided for the call to function.
 * @param {function} fn The function to invoke.
 * @param {*} arguments
 * @return {*} result of the function call.
 */
Zone.prototype.apply = function apply(thisArg, fn, args) {
  assert(!this._closed, 'Calling apply(...) on a closed zone: ' + this.name);
  if (global.zone === this) {
    return fn.apply(thisArg, args);
  } else {
    var previousZone = zone;
    global.zone = this;
    var result = this._apply(thisArg, fn, args);
    global.zone = previousZone;
    return result;
  }
};


/**
 * The applyAsync() method calls a function with a given this value
 * and arguments provided as an array on the next tick within this Zone.
 *
 * @param {object} thisArg The value of this provided for the call to function.
 * @param {function} fn The function to invoke.
 * @param {*} arguments
 */
Zone.prototype.applyAsync = function applyAsync(thisArg, fn, args) {
  assert(!this._closed);
  result = scheduler.enqueueCallback(this, thisArg, fn, args);
};


/**
 * The call() method calls a function with a given this value and arguments
 * provided indivigually within the zone.
 *
 * @param {Object} thisArg
 * @param {function} fn The function to run.
 * @param {*} arguments
 * @return {*} result of the function call.
 */
Zone.prototype.call = function call(thisArg, fn) {
  var args = new Array(arguments.length - 2);
  for (var i = 2; i < arguments.length; i++) {
    args[i - 2] = arguments[i];
  }
  return this.apply(thisArg, fn, args);
};


/**
 * The call() method calls a function with a given this value and arguments
 * provided indivigually within the zone on the next tick.
 *
 * @param {Object} thisArg
 * @param {function} fn The function to run.
 * @param {*} arguments
 */
Zone.prototype.callAsync = function callAsync(thisArg, fn) {
  var args = new Array(arguments.length - 2);
  for (var i = 2; i < arguments.length; i++) {
    args[i - 2] = arguments[i];
  }
  this.applyAsync(thisArg, fn, args);
};


/**
 * Run a function within the Zone immediately
 *
 * @param {function} fn The function to run.
 * @param {*} arguments
 * @return {*} result of the function call.
 * @private
 */
Zone.prototype._run = function run(fn) {
  if (this._beforeTask) {
    this.apply(this, this._beforeTask);
  }
  var args = new Array(arguments.length - 1);
  for (var i = 1; i < arguments.length; i++) {
    args[i - 1] = arguments[i];
  }
  var result = this.apply(this, fn, args);
  if (this._afterTask) {
    this.apply(this, this._afterTask);
  }
  return result;
};


/**
 * Alias to ```process.nextTick```
 *
 * @param {function} fn The function to wrap within this zone.
 */
Zone.prototype.scheduleMicrotask = function(cb) {
  scheduler.enqueueCallback(this, this, cb);
  return null;
};


/**
 * The bindCallback() method takes a function and returns a wrapped version
 * which can be run within the zone at a later time. Unlike ```Zone.create```
 * and ```Zone.define```, this call does not create a new zone to run the
 * function.
 *
 * @param {Object} thisArg The value of `this` within the function.
 * @param {function} fn The function to wrap within this zone.
 * @param {Zone} sourceZone The zone from which this callback is intended to be
 *                          called.
 * @options {object} [Options]
 * @prop {bool} [autoRelease=true] Automatically release this function after it
 *                                 is run. If you choose not to autoRelease the
 *                                 callback, you will need to explicitly call
 *                                 ```zone.release(callback)``` to allow the
 *                                 zone to exit.
 * @prop {ZoneCallback~Signal} [signalCallback]
 * @prop {ZoneCallback~Release} [releaseCallback]
 * @end
 */
Zone.prototype.bindCallback = function(thisArg, fn, soureZone, options) {
  var autoRelease = true;
  var signalCallback = null;
  var releaseCallback = null;
  var name = 'anonymous';
  if (options) {
    if (options.name) {
      name = options.name;
    }
    if (options.hasOwnProperty('autoRelease')) {
      autoRelease = options.autoRelease === true;
    }
    if (options.signalCallback &&
        typeof options.signalCallback === 'function') {
      signalCallback = options.signalCallback;
    }
    if (options.releaseCallback &&
        typeof options.releaseCallback === 'function') {
      releaseCallback = options.releaseCallback;
    }
  }

  var delegate = new ZoneCallback(name, soureZone, this, fn, autoRelease,
                                  signalCallback, releaseCallback);
  var wrapper = function() {
    if (arguments[0] === ZoneCallback._GetDelegateCommand) {
      return delegate;
    }
    return delegate.apply(this, arguments);
  };
  return wrapper;
};


/**
 * The bindAsyncCallback() method takes a function and returns a wrapped version
 * which when called will register a async callback which will run
 * within the zone. Unlike ```Zone.create``` and ```Zone.define```, this call
 * does not create a new zone to run the function.
 *
 * @param {Object} thisArg The value of `this` within the function.
 * @param {function} fn The function to wrap within this zone.
 * @param {Zone} sourceZone The zone from which this callback is intended to be
 *                          called.
 * @options {object} [Options]
 * @prop {bool} [autoRelease=true] Automatically release this function after it
 *                                 is run. If you choose not to autoRelease the
 *                                 callback, you will need to explicitly call
 *                                 ```zone.release(callback)``` to allow the
 *                                 zone to exit.
 * @prop {ZoneCallback~signal} [signalCallback]
 * @prop {ZoneCallback~release} [releaseCallback]
 * @end
 */
Zone.prototype.bindAsyncCallback = function(thisArg, fn, soureZone, options) {
  var autoRelease = true;
  var signalCallback = null;
  var releaseCallback = null;
  var name = 'anonymous';
  if (options) {
    if (options.name) {
      name = options.name;
    }
    if (options.hasOwnProperty('autoRelease')) {
      autoRelease = options.autoRelease === true;
    }
    if (options.signalCallback &&
        typeof options.signalCallback === 'function') {
      signalCallback = options.signalCallback;
    }
    if (options.releaseCallback &&
        typeof options.releaseCallback === 'function') {
      releaseCallback = options.releaseCallback;
    }
  }

  var delegate = new ZoneCallback(name, soureZone, this, fn, autoRelease,
                                  signalCallback, releaseCallback);
  var wrapper = function() {
    if (arguments[0] === ZoneCallback._GetDelegateCommand) {
      return delegate;
    }
    return delegate.applyAsync(thisArg, arguments);
  };
  return wrapper;
};


/**
 * Releases a callback created using ```Zone.bindCallback``` or
 * ```Zone.bindAsyncCallback```.
 *
 * @param {function} callbackFunc
 */
Zone.prototype.releaseCallback = function releaseCallback(callbackFunc) {
  callbackFunc(ZoneCallback._GetDelegateCommand).release();
};


/**
 * Signal this zone to exit since the parent zone has either recieved a result
 * or and error. The signal method may be called multiple times by the parent
 * if the parent first succeeded but later got an error while finalizing.
 *
 * @param {error} err The error from the parent of null in succesful case.
 */
Zone.prototype.signal = function signal(err) {
  if (err) {
    if (this._error) return;

    this._error = err;
    this._result = undefined;
    this._exiting = true;

    // If the last signaled child was signaled for the reason of the zone
    // being empty, we now need to re-signal it with an error reason.
    this._lastSignaledChild = null;

  } else /* graceful */ {
    if (this._exiting) return;

    this._exiting = true;
  }
  this.enqueueFinalize();
};


/**
 * Prepare this zone for cleanup
 */
Zone.prototype.release = function() { Zone.prototype.enqueueFinalize(); };


/**
 * Triggers zone to exit with a succesful result. The result will be passed on
 * to the main or success callbacks in the parent zone.
 *
 * @param {*} arguments The return values to pass to callbacks.
 */
Zone.prototype.return = function() {
  if (this._error)
    return;
  else if (this._result !== undefined)
    return void this.throw(new Error('Zone result already set.'));

  this._result = Array.prototype.slice.call(arguments);
  this._exiting = true;
  this.enqueueFinalize();
};


/**
 * Alias to `zone.return(...)`
 *
 * @param {*} arguments The return values to pass to callbacks.
 */
Zone.prototype.resolve = Zone.prototype.return;


/**
 * Alias for ```Zone.throw``` and ```Zone.return``` calls.
 *
 * @param {error} err Error to pass back or null if succesful.
 * @param {*} arguments The return values to pass to callbacks.
 */
Zone.prototype.complete = function complete(err) {
  if (err !== null) {
    return this.throw(err);
  } else {
    var args = new Array(arguments.length - 1);
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
    return this.return .apply(this, args);
  }
};


/**
 * Triggers zone to exit with an error. Only the first error is reported to the
 * zone exit callbacks. Other errors are discarded.
 *
 * @param {error} err Error to pass back or null if succesful.
 */
Zone.prototype.throw = function(err) {
  if (this._error) return;

  if (!(err instanceof Error)) err = new NonError(err);

  if (!err.zone) {
    Object.defineProperty(err, 'zone', {value: zone, enumerable: false});
  }

  this._result = undefined;
  this._error = err;
  this._exiting = true;

  // If the last signaled child was signaled for the reason of the zone
  // being empty, we now need to re-signal it with an error reason.
  this._lastSignaledChild = null;
  this.enqueueFinalize(err);
};


/**
 * Alias to `zone.throw`
 */
Zone.prototype.reject = Zone.prototype.throw;


/**
 * Check if a zone is ready for finalization. If it is then add this Zone to
 * the queue of Zones to be cleaned up on the next scheduler iteration.
 *
 * Zone cleanup decision is as follows:
 *   - If this is the root zone, then skip. (Root zone is cleaned when process
 *     exits)
 *   - If the zone is already in the process of exiting due to ```Zone.throw```,
 *     ```Zone.result``` or due to something propogated form parent then enqueue
 *     the zone.
 *   - If not then, if there are any pending scheduled tasks for callbacks that
 *     can be trigerred from a parent zone then no not enqueue zone.
 *
 * _Note_ : This function only scheduled the Zone for cleanup, it does not do
 *          any cleanup itself and should be as efficient as possible.
 *
 * @private
 */
Zone.prototype.enqueueFinalize = function enqueueFinalize() {
  if (this._closed) {
    return;
  }

  if (!this._exiting &&
      (this._numScheduledTasks > 0 || this._numNonLocalZoneCallbacks > 0)) {
    return;
  }

  if (!this._finalizerScheduled) {
    this._finalizerScheduled = true;
    scheduler.enqueueZone(this);
  }
};


/**
 * Dequeue this zone from scheduled cleanup. This is generally done if a task is
 * scheduled to run on the next tick.
 *
 * @private
 */
Zone.prototype.dequeueFinalize = function dequeueFinalize() {
  this._finalizerScheduled = false;
  scheduler.dequeueZone(this);
};


/**
 * Helper function to isolate try-finally clause for optimization
 *
 * @private
 */
Zone.prototype._finalizeHelper = function _finalizeHelper(childToSignal) {
  var previousZone = zone;
  global.zone = this;
  try {
    childToSignal.signal(this._error);
  } finally {
    global.zone = previousZone;
  }
};


/**
 * Cleanup this zone's children followed by the zone itself
 * @private
 */
Zone.prototype._finalize = function _finalize() {
  this._finalizerScheduled = false;
  assert(!this._closed);

  if (!this._lastChild) {
    // release all ZoneCallbacks. If the callback is not local, then it is
    // either a nodejs op or from parent zone and needs to be signalled instead
    // of released
    var zoneCallback = this._lastZoneCallback;
    while (zoneCallback) {
      if (zoneCallback._sourceZone !== this) {
        zoneCallback.signal(this._error);
      }else {
        zoneCallback.release();
      }
      zoneCallback = zoneCallback._previousSibling;
    }

    // If any ZoneCallbacks's remain, then they were probably I/O operations
    // that could not be cancelled. Wait for them.
    if (this._lastZoneCallback) {
      return;
    }

    // cleanup all ZoneCallbacks for which this is a source zone
    var cbConsumer = this._lastCallbackConsumer;
    while (cbConsumer) {
      cbConsumer.signal();
      cbConsumer = cbConsumer._previousCBConsumer;
    }

    this._closed = true;
    this._invokeCallbacks();
  } else if (this._lastSignaledChild !== this._lastChild) {
    // This case is triggered if the last signal child caused new child
    // delegte to be created. (eg: TCP socket cleanup causes close event to be
    // triggered)

    // signal the new last child
    this._lastSignaledChild = this._lastChild;
    if (this._lastSignaledChild) {
      this._finalizeHelper(this._lastSignaledChild);
    }
  }
};

Zone.prototype._invokeCallbacks = function() {
  if (!this._isRoot) {
    if (this._errorFirstCallback) {
      // call the main callback
      scheduler.enqueueCallback(this.parent, this.parent,
                                this._errorFirstCallback,
                                [this._error].concat(this._result || []));
    } else if (!this._error && this._successCallback) {
      // success so call the success callback
      scheduler.enqueueCallback(this.parent, this.parent, this._successCallback,
                                this._result || []);
    } else if (this._error && this._errorCallback) {
      // error so call the error callback
      scheduler.enqueueCallback(this.parent, this.parent, this._errorCallback,
                                [this._error]);
    } else if (this._error) {
      // no callbacks registered. Let parent cleanup this zone and other
      // sibling zones
      this.parent.throw(this._error);
    }
    this.parent._unregisterChild(this);
  } else if (this._error) {
    // error in root zone
    console.error(this._error.zoneStack);
    process.exit(1);
  }
};


/**
 * Debug function which returns a string with the current state of this Zone
 *and
 * its children.
 *
 * @return {String}
 */
Zone.prototype.dump = function dump(options) {
  options = options || {indent: 0};
  var indent = options.indent;
  var prefix = (new Array(indent + 1)).join('  ');

  var isAlive = this === this.root || this._numScheduledTasks > 0 ||
                this._numNonLocalZoneCallbacks > 0;

  var ownDesc = util.format(
      '%s%s[Zone        ] #%d %s (%d tasks, %d external callbacks)\n', prefix,
      (isAlive ? '+' : ' '), this.id, this.name || 'anonymous',
      this._numScheduledTasks, this._numNonLocalZoneCallbacks);

  var childDesc = '';
  var child = this._lastChild;
  while (child) {
    childDesc = child.dump({indent: indent + 1}) + childDesc;
    child = child._previousSibling;
  }
  child = this._lastZoneCallback;
  while (child) {
    childDesc = child.dump({indent: indent + 1}) + childDesc;
    child = child._previousSibling;
  }

  return ownDesc + childDesc;
};


/**
 * To aid formatting a long stack trace in node v0.10, make
 * Zone.prototype.toString() return the zone name.
 *
 * @return {String}
 */
Zone.prototype.toString = function toString() {
  return this.name;
};


/**
 * Check zone callback and options
 * @private
 */
function _parseZoneOptions(options, callback) {
  if (callback === undefined && typeof options === 'function') {
    callback = options;
    options = undefined;
  }

  if (callback && typeof callback !== 'function') {
    throw new TypeError('callback is not a function');
  }

  if (!options) {
    options = {callback: callback};
  }

  return options;
}

Zone.prototype.Zone = Zone;


/**
 * Boolean which enables long stack traces.
 * (Disabled by default to improove performance)
 *
 * @type {bool}
 */
Zone.longStackSupport = true;
if (process.env.hasOwnProperty('NODE_ENV') && process.env.NODE_ENV !== 'development') {
  Zone.longStackSupport = false;
}

// Constructor for the root zone.
function RootZone() {
  Zone.call(this, null, {'isConstructingRootZone': true});
}

RootZone.prototype = Zone.prototype;

exports.RootZone = RootZone;
exports.Zone = Zone;

// Callbacks

/**
 * @callback Zone~Callback
 *
 * @param {error} error On error, the error object. Null if zone
 *                      exited succesfully.
 * @param {*} arguments On success, this will contains the result of the
 *                      functions run within the zone.
 */

/**
 * @callback Zone~OnSuccess
 *
 * @param {*} arguments On success, this will contains the result of the
 *                      functions run within the zone.
 */

/**
 * @callback Zone~OnFailure
 *
 * @param {error} error On error, the error object. Null if zone
 *                      exited succesfully.
 */

/**
 * @callback ZoneCallback~Signal
 *
 * User provided handler for when bound callback gets a signal and needs to
 * clean up. *Note* : You will need to explicity call ```this.release()```
 * after performing your cleanup.
 *
 * @param {error} error If an error occured, will contaner the error object.
 *                      Null otherwise.
 */

/**
 * @callback Zone~beforeTask
 *
 * Before a function invoked within the zone, this hook runs.
 */

/**
 * @callback Zone~afterTask
 *
 * After a function in a zone runs, the afterTask hook runs.
 */

/**
 * @callback ZoneCallback~Release
 *
 * User provided handler for performing final cleanup when callback is released.
 */
