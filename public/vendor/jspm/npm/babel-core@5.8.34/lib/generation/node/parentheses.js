/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.NullableTypeAnnotation = NullableTypeAnnotation;
exports.UpdateExpression = UpdateExpression;
exports.ObjectExpression = ObjectExpression;
exports.Binary = Binary;
exports.BinaryExpression = BinaryExpression;
exports.SequenceExpression = SequenceExpression;
exports.YieldExpression = YieldExpression;
exports.ClassExpression = ClassExpression;
exports.UnaryLike = UnaryLike;
exports.FunctionExpression = FunctionExpression;
exports.ConditionalExpression = ConditionalExpression;
exports.AssignmentExpression = AssignmentExpression;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashCollectionEach = require("lodash/collection/each");

var _lodashCollectionEach2 = _interopRequireDefault(_lodashCollectionEach);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Create a mapping of operators to precendence.
 *
 * @example
 * { "==": 6, "+": 9 }
 */
var PRECEDENCE = {};

_lodashCollectionEach2["default"]([["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "===", "!=", "!=="], ["<", ">", "<=", ">=", "in", "instanceof"], [">>", "<<", ">>>"], ["+", "-"], ["*", "/", "%"], ["**"]], function (tier, i) {
  _lodashCollectionEach2["default"](tier, function (op) {
    PRECEDENCE[op] = i;
  });
});

/**
 * Test if NullableTypeAnnotation needs parentheses.
 */

function NullableTypeAnnotation(node, parent) {
  return t.isArrayTypeAnnotation(parent);
}

/**
 * Alias NullableTypeAnnotation test as FunctionTypeAnnotation.
 */

exports.FunctionTypeAnnotation = NullableTypeAnnotation;

/**
 * Test if UpdateExpression needs parentheses.
 */

function UpdateExpression(node, parent) {
  if (t.isMemberExpression(parent) && parent.object === node) {
    // (foo++).test()
    return true;
  }
}

/**
 * Test if ObjectExpression needs parentheses.
 */

function ObjectExpression(node, parent) {
  if (t.isExpressionStatement(parent)) {
    // ({ foo: "bar" });
    return true;
  }

  if (t.isMemberExpression(parent) && parent.object === node) {
    // ({ foo: "bar" }).foo
    return true;
  }

  return false;
}

/**
 * Test if Binary needs parentheses.
 */

function Binary(node, parent) {
  if ((t.isCallExpression(parent) || t.isNewExpression(parent)) && parent.callee === node) {
    return true;
  }

  if (t.isUnaryLike(parent)) {
    return true;
  }

  if (t.isMemberExpression(parent) && parent.object === node) {
    return true;
  }

  if (t.isBinary(parent)) {
    var parentOp = parent.operator;
    var parentPos = PRECEDENCE[parentOp];

    var nodeOp = node.operator;
    var nodePos = PRECEDENCE[nodeOp];

    if (parentPos > nodePos) {
      return true;
    }

    // Logical expressions with the same precedence don't need parens.
    if (parentPos === nodePos && parent.right === node && !t.isLogicalExpression(parent)) {
      return true;
    }
  }
}

/**
 * Test if BinaryExpression needs parentheses.
 */

function BinaryExpression(node, parent) {
  if (node.operator === "in") {
    // var i = (1 in []);
    if (t.isVariableDeclarator(parent)) {
      return true;
    }

    // for ((1 in []);;);
    if (t.isFor(parent)) {
      return true;
    }
  }
}

/**
 * Test if SequenceExpression needs parentheses.
 */

function SequenceExpression(node, parent) {
  if (t.isForStatement(parent)) {
    // Although parentheses wouldn't hurt around sequence
    // expressions in the head of for loops, traditional style
    // dictates that e.g. i++, j++ should not be wrapped with
    // parentheses.
    return false;
  }

  if (t.isExpressionStatement(parent) && parent.expression === node) {
    return false;
  }

  if (t.isReturnStatement(parent)) {
    return false;
  }

  // Otherwise err on the side of overparenthesization, adding
  // explicit exceptions above if this proves overzealous.
  return true;
}

/**
 * Test if YieldExpression needs parentheses.
 */

function YieldExpression(node, parent) {
  return t.isBinary(parent) || t.isUnaryLike(parent) || t.isCallExpression(parent) || t.isMemberExpression(parent) || t.isNewExpression(parent) || t.isConditionalExpression(parent) || t.isYieldExpression(parent);
}

/**
 * Test if ClassExpression needs parentheses.
 */

function ClassExpression(node, parent) {
  return t.isExpressionStatement(parent);
}

/**
 * Test if UnaryLike needs parentheses.
 */

function UnaryLike(node, parent) {
  return t.isMemberExpression(parent) && parent.object === node;
}

/**
 * Test if FunctionExpression needs parentheses.
 */

function FunctionExpression(node, parent) {
  // function () {};
  if (t.isExpressionStatement(parent)) {
    return true;
  }

  // (function test() {}).name;
  if (t.isMemberExpression(parent) && parent.object === node) {
    return true;
  }

  // (function () {})();
  if (t.isCallExpression(parent) && parent.callee === node) {
    return true;
  }
}

/**
 * Test if ConditionalExpression needs parentheses.
 */

function ConditionalExpression(node, parent) {
  if (t.isUnaryLike(parent)) {
    return true;
  }

  if (t.isBinary(parent)) {
    return true;
  }

  if (t.isCallExpression(parent) || t.isNewExpression(parent)) {
    if (parent.callee === node) {
      return true;
    }
  }

  if (t.isConditionalExpression(parent) && parent.test === node) {
    return true;
  }

  if (t.isMemberExpression(parent) && parent.object === node) {
    return true;
  }

  return false;
}

/**
 * Test if AssignmentExpression needs parentheses.
 */

function AssignmentExpression(node) {
  if (t.isObjectPattern(node.left)) {
    return true;
  } else {
    return ConditionalExpression.apply(undefined, arguments);
  }
}