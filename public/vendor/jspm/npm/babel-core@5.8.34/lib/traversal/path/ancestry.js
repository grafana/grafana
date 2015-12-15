/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.findParent = findParent;
exports.getFunctionParent = getFunctionParent;
exports.getStatementParent = getStatementParent;
exports.getEarliestCommonAncestorFrom = getEarliestCommonAncestorFrom;
exports.getDeepestCommonAncestorFrom = getDeepestCommonAncestorFrom;
exports.getAncestry = getAncestry;
exports.inType = inType;
exports.inShadow = inShadow;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

/**
 * Call the provided `callback` with the `NodePath`s of all the parents.
 * When the `callback` returns a truthy value, we return that node path.
 */

function findParent(callback) {
  var path = this;
  while (path = path.parentPath) {
    if (callback(path)) return path;
  }
  return null;
}

/**
 * Get the parent function of the current path.
 */

function getFunctionParent() {
  return this.findParent(function (path) {
    return path.isFunction() || path.isProgram();
  });
}

/**
 * Walk up the tree until we hit a parent node path in a list.
 */

function getStatementParent() {
  var path = this;
  do {
    if (Array.isArray(path.container)) {
      return path;
    }
  } while (path = path.parentPath);
}

/**
 * Get the deepest common ancestor and then from it, get the earliest relationship path
 * to that ancestor.
 *
 * Earliest is defined as being "before" all the other nodes in terms of list container
 * position and visiting key.
 */

function getEarliestCommonAncestorFrom(paths) {
  return this.getDeepestCommonAncestorFrom(paths, function (deepest, i, ancestries) {
    var earliest;
    var keys = t.VISITOR_KEYS[deepest.type];

    var _arr = ancestries;
    for (var _i = 0; _i < _arr.length; _i++) {
      var ancestry = _arr[_i];
      var path = ancestry[i + 1];

      // first path
      if (!earliest) {
        earliest = path;
        continue;
      }

      // handle containers
      if (path.listKey && earliest.listKey === path.listKey) {
        // we're in the same container so check if we're earlier
        if (path.key < earliest.key) {
          earliest = path;
          continue;
        }
      }

      // handle keys
      var earliestKeyIndex = keys.indexOf(earliest.parentKey);
      var currentKeyIndex = keys.indexOf(path.parentKey);
      if (earliestKeyIndex > currentKeyIndex) {
        // key appears before so it's earlier
        earliest = path;
      }
    }

    return earliest;
  });
}

/**
 * Get the earliest path in the tree where the provided `paths` intersect.
 *
 * TODO: Possible optimisation target.
 */

function getDeepestCommonAncestorFrom(paths, filter) {
  // istanbul ignore next

  var _this = this;

  if (!paths.length) {
    return this;
  }

  if (paths.length === 1) {
    return paths[0];
  }

  // minimum depth of the tree so we know the highest node
  var minDepth = Infinity;

  // last common ancestor
  var lastCommonIndex, lastCommon;

  // get the ancestors of the path, breaking when the parent exceeds ourselves
  var ancestries = paths.map(function (path) {
    var ancestry = [];

    do {
      ancestry.unshift(path);
    } while ((path = path.parentPath) && path !== _this);

    // save min depth to avoid going too far in
    if (ancestry.length < minDepth) {
      minDepth = ancestry.length;
    }

    return ancestry;
  });

  // get the first ancestry so we have a seed to assess all other ancestries with
  var first = ancestries[0];

  // check ancestor equality
  depthLoop: for (var i = 0; i < minDepth; i++) {
    var shouldMatch = first[i];

    var _arr2 = ancestries;
    for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
      var ancestry = _arr2[_i2];
      if (ancestry[i] !== shouldMatch) {
        // we've hit a snag
        break depthLoop;
      }
    }

    // next iteration may break so store these so they can be returned
    lastCommonIndex = i;
    lastCommon = shouldMatch;
  }

  if (lastCommon) {
    if (filter) {
      return filter(lastCommon, lastCommonIndex, ancestries);
    } else {
      return lastCommon;
    }
  } else {
    throw new Error("Couldn't find intersection");
  }
}

/**
 * Build an array of node paths containing the entire ancestry of the current node path.
 *
 * NOTE: The current node path is included in this.
 */

function getAncestry() {
  var path = this;
  var paths = [];
  do {
    paths.push(path);
  } while (path = path.parentPath);
  return paths;
}

/**
 * [Please add a description.]
 */

function inType() {
  var path = this;
  while (path) {
    var _arr3 = arguments;

    for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
      var type = _arr3[_i3];
      if (path.node.type === type) return true;
    }
    path = path.parentPath;
  }

  return false;
}

/**
 * Check if we're inside a shadowed function.
 */

function inShadow(key) {
  var path = this;
  do {
    if (path.isFunction()) {
      var shadow = path.node.shadow;
      if (shadow) {
        // this is because sometimes we may have a `shadow` value of:
        //
        //   { this: false }
        //
        // we need to catch this case if `inShadow` has been passed a `key`
        if (!key || shadow[key] !== false) {
          return path;
        }
      } else if (path.isArrowFunctionExpression()) {
        return path;
      }

      // normal function, we've found our function context
      return null;
    }
  } while (path = path.parentPath);
  return null;
}