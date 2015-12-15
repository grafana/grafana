/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports["default"] = traverse;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _context = require("./context");

var _context2 = _interopRequireDefault(_context);

var _visitors = require("./visitors");

var visitors = _interopRequireWildcard(_visitors);

var _messages = require("../messages");

var messages = _interopRequireWildcard(_messages);

var _lodashCollectionIncludes = require("lodash/collection/includes");

var _lodashCollectionIncludes2 = _interopRequireDefault(_lodashCollectionIncludes);

var _types = require("../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function traverse(parent, opts, scope, state, parentPath) {
  if (!parent) return;
  if (!opts) opts = {};

  if (!opts.noScope && !scope) {
    if (parent.type !== "Program" && parent.type !== "File") {
      throw new Error(messages.get("traverseNeedsParent", parent.type));
    }
  }

  visitors.explode(opts);

  // array of nodes
  if (Array.isArray(parent)) {
    for (var i = 0; i < parent.length; i++) {
      traverse.node(parent[i], opts, scope, state, parentPath);
    }
  } else {
    traverse.node(parent, opts, scope, state, parentPath);
  }
}

traverse.visitors = visitors;
traverse.verify = visitors.verify;
traverse.explode = visitors.explode;

/**
 * [Please add a description.]
 */

traverse.node = function (node, opts, scope, state, parentPath, skipKeys) {
  var keys = t.VISITOR_KEYS[node.type];
  if (!keys) return;

  var context = new _context2["default"](scope, opts, state, parentPath);
  var _arr = keys;
  for (var _i = 0; _i < _arr.length; _i++) {
    var key = _arr[_i];
    if (skipKeys && skipKeys[key]) continue;
    if (context.visit(node, key)) return;
  }
};

/**
 * [Please add a description.]
 */

var CLEAR_KEYS = t.COMMENT_KEYS.concat(["_scopeInfo", "_paths", "tokens", "comments", "start", "end", "loc", "raw", "rawValue"]);

/**
 * [Please add a description.]
 */

traverse.clearNode = function (node) {
  for (var i = 0; i < CLEAR_KEYS.length; i++) {
    var key = CLEAR_KEYS[i];
    if (node[key] != null) node[key] = undefined;
  }
};

/**
 * [Please add a description.]
 */

var clearVisitor = {
  noScope: true,
  exit: traverse.clearNode
};

/**
 * [Please add a description.]
 */

traverse.removeProperties = function (tree) {
  traverse(tree, clearVisitor);
  traverse.clearNode(tree);

  return tree;
};

/**
 * [Please add a description.]
 */

function hasBlacklistedType(node, parent, scope, state) {
  if (node.type === state.type) {
    state.has = true;
    this.skip();
  }
}

/**
 * [Please add a description.]
 */

traverse.hasType = function (tree, scope, type, blacklistTypes) {
  // the node we're searching in is blacklisted
  if (_lodashCollectionIncludes2["default"](blacklistTypes, tree.type)) return false;

  // the type we're looking for is the same as the passed node
  if (tree.type === type) return true;

  var state = {
    has: false,
    type: type
  };

  traverse(tree, {
    blacklist: blacklistTypes,
    enter: hasBlacklistedType
  }, scope, state);

  return state.has;
};
module.exports = exports["default"];