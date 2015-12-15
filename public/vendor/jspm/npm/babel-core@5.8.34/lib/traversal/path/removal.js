/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.remove = remove;
exports.dangerouslyRemove = dangerouslyRemove;
exports._callRemovalHooks = _callRemovalHooks;
exports._remove = _remove;
exports._markRemoved = _markRemoved;
exports._assertUnremoved = _assertUnremoved;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _libRemovalHooks = require("./lib/removal-hooks");

var removalHooks = _interopRequireWildcard(_libRemovalHooks);

/**
 * Deprecated in favor of `dangerouslyRemove` as it's far more scary and more accurately portrays
 * the risk.
 */

function remove() {
  console.trace("Path#remove has been renamed to Path#dangerouslyRemove, removing a node is extremely dangerous so please refrain using it.");
  return this.dangerouslyRemove();
}

/**
 * Dangerously remove the current node. This may sometimes result in a tainted
 * invalid AST so use with caution.
 */

function dangerouslyRemove() {
  this._assertUnremoved();

  this.resync();

  if (this._callRemovalHooks("pre")) {
    this._markRemoved();
    return;
  }

  this.shareCommentsWithSiblings();
  this._remove();
  this._markRemoved();

  this._callRemovalHooks("post");
}

/**
 * [Please add a description.]
 */

function _callRemovalHooks(position) {
  var _arr = removalHooks[position];

  for (var _i = 0; _i < _arr.length; _i++) {
    var fn = _arr[_i];
    if (fn(this, this.parentPath)) return true;
  }
}

/**
 * [Please add a description.]
 */

function _remove() {
  if (Array.isArray(this.container)) {
    this.container.splice(this.key, 1);
    this.updateSiblingKeys(this.key, -1);
  } else {
    this.container[this.key] = null;
  }
}

/**
 * [Please add a description.]
 */

function _markRemoved() {
  this.shouldSkip = true;
  this.removed = true;
  this.node = null;
}

/**
 * [Please add a description.]
 */

function _assertUnremoved() {
  if (this.removed) {
    throw this.errorWithNode("NodePath has been removed so is read-only.");
  }
}