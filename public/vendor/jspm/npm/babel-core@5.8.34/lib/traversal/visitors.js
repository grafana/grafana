/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.explode = explode;
exports.verify = verify;
exports.merge = merge;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _pathLibVirtualTypes = require("./path/lib/virtual-types");

var virtualTypes = _interopRequireWildcard(_pathLibVirtualTypes);

var _messages = require("../messages");

var messages = _interopRequireWildcard(_messages);

var _types = require("../types");

var t = _interopRequireWildcard(_types);

var _lodashLangClone = require("lodash/lang/clone");

var _lodashLangClone2 = _interopRequireDefault(_lodashLangClone);

/**
 * [Please add a description.]
 */

function explode(visitor) {
  if (visitor._exploded) return visitor;
  visitor._exploded = true;

  // normalise pipes
  for (var nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    var parts = nodeType.split("|");
    if (parts.length === 1) continue;

    var fns = visitor[nodeType];
    delete visitor[nodeType];

    var _arr = parts;
    for (var _i = 0; _i < _arr.length; _i++) {
      var part = _arr[_i];
      visitor[part] = fns;
    }
  }

  // verify data structure
  verify(visitor);

  // make sure there's no __esModule type since this is because we're using loose mode
  // and it sets __esModule to be enumerable on all modules :(
  delete visitor.__esModule;

  // ensure visitors are objects
  ensureEntranceObjects(visitor);

  // ensure enter/exit callbacks are arrays
  ensureCallbackArrays(visitor);

  // add type wrappers

  var _arr2 = Object.keys(visitor);

  for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
    var nodeType = _arr2[_i2];
    if (shouldIgnoreKey(nodeType)) continue;

    var wrapper = virtualTypes[nodeType];
    if (!wrapper) continue;

    // wrap all the functions
    var fns = visitor[nodeType];
    for (var type in fns) {
      fns[type] = wrapCheck(wrapper, fns[type]);
    }

    // clear it from the visitor
    delete visitor[nodeType];

    if (wrapper.types) {
      var _arr4 = wrapper.types;

      for (var _i4 = 0; _i4 < _arr4.length; _i4++) {
        var type = _arr4[_i4];
        // merge the visitor if necessary or just put it back in
        if (visitor[type]) {
          mergePair(visitor[type], fns);
        } else {
          visitor[type] = fns;
        }
      }
    } else {
      mergePair(visitor, fns);
    }
  }

  // add aliases
  for (var nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    var fns = visitor[nodeType];

    var aliases = t.FLIPPED_ALIAS_KEYS[nodeType];
    if (!aliases) continue;

    // clear it from the visitor
    delete visitor[nodeType];

    var _arr3 = aliases;
    for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
      var alias = _arr3[_i3];
      var existing = visitor[alias];
      if (existing) {
        mergePair(existing, fns);
      } else {
        visitor[alias] = _lodashLangClone2["default"](fns);
      }
    }
  }

  for (var nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    ensureCallbackArrays(visitor[nodeType]);
  }

  return visitor;
}

/**
 * [Please add a description.]
 */

function verify(visitor) {
  if (visitor._verified) return;

  if (typeof visitor === "function") {
    throw new Error(messages.get("traverseVerifyRootFunction"));
  }

  for (var nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    if (t.TYPES.indexOf(nodeType) < 0) {
      throw new Error(messages.get("traverseVerifyNodeType", nodeType));
    }

    var visitors = visitor[nodeType];
    if (typeof visitors === "object") {
      for (var visitorKey in visitors) {
        if (visitorKey === "enter" || visitorKey === "exit") continue;
        throw new Error(messages.get("traverseVerifyVisitorProperty", nodeType, visitorKey));
      }
    }
  }

  visitor._verified = true;
}

/**
 * [Please add a description.]
 */

function merge(visitors) {
  var rootVisitor = {};

  var _arr5 = visitors;
  for (var _i5 = 0; _i5 < _arr5.length; _i5++) {
    var visitor = _arr5[_i5];
    explode(visitor);

    for (var type in visitor) {
      var nodeVisitor = rootVisitor[type] = rootVisitor[type] || {};
      mergePair(nodeVisitor, visitor[type]);
    }
  }

  return rootVisitor;
}

/**
 * [Please add a description.]
 */

function ensureEntranceObjects(obj) {
  for (var key in obj) {
    if (shouldIgnoreKey(key)) continue;

    var fns = obj[key];
    if (typeof fns === "function") {
      obj[key] = { enter: fns };
    }
  }
}

/**
 * Makes sure that enter and exit callbacks are arrays.
 */

function ensureCallbackArrays(obj) {
  if (obj.enter && !Array.isArray(obj.enter)) obj.enter = [obj.enter];
  if (obj.exit && !Array.isArray(obj.exit)) obj.exit = [obj.exit];
}

/**
 * [Please add a description.]
 */

function wrapCheck(wrapper, fn) {
  return function () {
    if (wrapper.checkPath(this)) {
      return fn.apply(this, arguments);
    }
  };
}

/**
 * [Please add a description.]
 */

function shouldIgnoreKey(key) {
  // internal/hidden key
  if (key[0] === "_") return true;

  // ignore function keys
  if (key === "enter" || key === "exit" || key === "shouldSkip") return true;

  // ignore other options
  if (key === "blacklist" || key === "noScope" || key === "skipKeys") return true;

  return false;
}

/**
 * [Please add a description.]
 */

function mergePair(dest, src) {
  for (var key in src) {
    dest[key] = [].concat(dest[key] || [], src[key]);
  }
}