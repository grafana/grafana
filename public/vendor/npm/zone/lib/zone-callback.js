var assert = require('assert');
var uid = require('./uid.js');


/**
 * @class ZoneCallback
 * This class represents a wrapped callback which is associated with a Zone.
 */
var ZoneCallback =
    function ZoneCallback(name_, sourceZone_, destZone_, fn, autoRelease_,
                          signalCallback_, releaseCallback_) {
  assert(typeof fn === 'function');
  assert(destZone_);

  this.name = name_;
  this.id = uid();
  this.autoRelease = autoRelease_;
  this.wrappedFn = fn;
  this._sourceZone = sourceZone_;
  this._destZone = destZone_;

  /**
   * A pointer to the previous sibling within the destination zone
   * @private
   */
  this._previousSibling = null;

  /**
   * A pointer to the next sibling within the destination zone
   * @private
   */
  this._nextSibling = null;

  /**
   * A pointer to the previous sibling within the source zone
   * @private
   */
  this._previousCBConsumer = null;

  /**
   * A pointer to the next sibling within the source zone
   * @private
   */
  this._nextCBConsumer = null;

  /**
   * A pointer to the next sibling within the source zone
   * @private
   */
  this._nextSibling = null;

  /**
   * User provided function which sould be callend when a signal is recieved
   */
  this.signal = signalCallback_ || ZoneCallback.prototype.signal;

  /**
   * Set to true when the ZoneCallback has been released and can no longer be
   * used.
   * @private
   */
  this._released = false;

  /**
   * User provided function which sould be called at time of release to do
   * additional cleanup
   * @private
   */
  this._userReleaseFunc = releaseCallback_;

  // If a sourceZone is provided, then register with it otherwise this is
  // an I/O callback, register as scheduled task
  if (this._sourceZone) {
    this._sourceZone._registerCBConsumer(this);
  } else {
    this._destZone._incrementScheduledTaskCount();
  }
  this._destZone._registerZoneCallback(this);
};


/**
 * The apply() method calls the wrapped function with a given `this` value and
 * arguments provided as an array within the destination Zone.
 *
 * @param {object} thisArg The value of this provided for the call to function.
 * @param {*} arguments
 * @return {*} result of the function call.
 */
ZoneCallback.prototype.apply = function call(thisArg, args) {
  assert(!this._released);

  var result = this._destZone.apply(thisArg, this.wrappedFn, args);
  if (this.autoRelease) {
    this.release();
  }
  return result;
};


/**
 * The applyAsync() method calls the wrapped function with a given `this` value
 * and arguments provided as an array within the destination Zone on the next
 * tick
 *
 * @param {object} thisArg The value of this provided for the call to function.
 * @param {*} arguments
 */
ZoneCallback.prototype.applyAsync = function callAsync(thisArg, args) {
  assert(!this._released);

  this._destZone.applyAsync(thisArg, this.wrappedFn, args);

  if (this.autoRelease) {
    this.release();
  }
};


/**
 * This method will call the user provided release function if any,
 * unregister itself with the destination and source zones, decrement refernce
 * counts.
 */
ZoneCallback.prototype.release = function release() {
  assert(!this._released);

  this.wrappedFn = null;
  this._released = true;
  if (this._userReleaseFunc) {
    this._userReleaseFunc.call(this);
  }
  if (this._sourceZone) {
    this._sourceZone._unregisterCBConsumer(this);
  } else {
    this._destZone._decrementScheduledTaskCount();
  }
  this._destZone._unregisterZoneCallback(this, true);
  this._userReleaseFunc = null;
};


/**
 * Default implementation of the cleanup signal handler. It can be overridden by
 * providing a custom signal handler via constructor options.
 */
ZoneCallback.prototype.signal = function signal(err) { this.release(); };


/**
 * Debug function which prints out the current state of this ZoneCallback and
 * its children
 */
ZoneCallback.prototype.dump = function dump(options) {
  options = options || {indent: 0};
  if (this._sourceZone !== null) {
    return '';
  }
  var indent = options.indent;
  var prefix = (new Array(indent + 1)).join('  ');
  var ownDesc = util.format('%s+[ZoneCallback] #%d %s\n', prefix, this.id,
                            this.name || this.wrappedFn.name || 'anonymous');
  return ownDesc;
};


/**
 * Object which can be passed to a wrapped function to return the ZoneCallback
 * object associated with it.
 */
ZoneCallback._GetDelegateCommand = {};
module.exports = ZoneCallback;
