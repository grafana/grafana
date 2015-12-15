/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _whitespace = require("./whitespace");

var _whitespace2 = _interopRequireDefault(_whitespace);

var _parentheses = require("./parentheses");

var parens = _interopRequireWildcard(_parentheses);

var _lodashCollectionEach = require("lodash/collection/each");

var _lodashCollectionEach2 = _interopRequireDefault(_lodashCollectionEach);

var _lodashCollectionSome = require("lodash/collection/some");

var _lodashCollectionSome2 = _interopRequireDefault(_lodashCollectionSome);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Test if node matches a set of type-matcher pairs.
 * @example
 * find({
 *   VariableDeclaration(node, parent) {
 *     return true;
 *   }
 * }, node, parent);
 */

var find = function find(obj, node, parent) {
  if (!obj) return;
  var result;

  var types = Object.keys(obj);
  for (var i = 0; i < types.length; i++) {
    var type = types[i];

    if (t.is(type, node)) {
      var fn = obj[type];
      result = fn(node, parent);
      if (result != null) break;
    }
  }

  return result;
};

/**
 * Whitespace and Parenthesis related methods for nodes.
 */

var Node = (function () {
  function Node(node, parent) {
    _classCallCheck(this, Node);

    this.parent = parent;
    this.node = node;
  }

  /**
   * Add all static methods from `Node` to `Node.prototype`.
   */

  /**
   * Test if `node` can have whitespace set by the user.
   */

  Node.isUserWhitespacable = function isUserWhitespacable(node) {
    return t.isUserWhitespacable(node);
  };

  /**
   * Test if a `node` requires whitespace.
   */

  Node.needsWhitespace = function needsWhitespace(node, parent, type) {
    if (!node) return 0;

    if (t.isExpressionStatement(node)) {
      node = node.expression;
    }

    var linesInfo = find(_whitespace2["default"].nodes, node, parent);

    if (!linesInfo) {
      var items = find(_whitespace2["default"].list, node, parent);
      if (items) {
        for (var i = 0; i < items.length; i++) {
          linesInfo = Node.needsWhitespace(items[i], node, type);
          if (linesInfo) break;
        }
      }
    }

    return linesInfo && linesInfo[type] || 0;
  };

  /**
   * Test if a `node` requires whitespace before it.
   */

  Node.needsWhitespaceBefore = function needsWhitespaceBefore(node, parent) {
    return Node.needsWhitespace(node, parent, "before");
  };

  /**
   * Test if a `note` requires whitespace after it.
   */

  Node.needsWhitespaceAfter = function needsWhitespaceAfter(node, parent) {
    return Node.needsWhitespace(node, parent, "after");
  };

  /**
   * Test if a `node` needs parentheses around it.
   */

  Node.needsParens = function needsParens(node, parent) {
    if (!parent) return false;

    if (t.isNewExpression(parent) && parent.callee === node) {
      if (t.isCallExpression(node)) return true;

      var hasCall = _lodashCollectionSome2["default"](node, function (val) {
        return t.isCallExpression(val);
      });
      if (hasCall) return true;
    }

    return find(parens, node, parent);
  };

  return Node;
})();

exports["default"] = Node;
_lodashCollectionEach2["default"](Node, function (fn, key) {
  Node.prototype[key] = function () {
    // Avoid leaking arguments to prevent deoptimization
    var args = new Array(arguments.length + 2);

    args[0] = this.node;
    args[1] = this.parent;

    for (var i = 0; i < args.length; i++) {
      args[i + 2] = arguments[i];
    }

    return Node[key].apply(null, args);
  };
});
module.exports = exports["default"];