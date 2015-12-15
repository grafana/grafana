/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.UnaryExpression = UnaryExpression;
exports.DoExpression = DoExpression;
exports.ParenthesizedExpression = ParenthesizedExpression;
exports.UpdateExpression = UpdateExpression;
exports.ConditionalExpression = ConditionalExpression;
exports.NewExpression = NewExpression;
exports.SequenceExpression = SequenceExpression;
exports.ThisExpression = ThisExpression;
exports.Super = Super;
exports.Decorator = Decorator;
exports.CallExpression = CallExpression;
exports.EmptyStatement = EmptyStatement;
exports.ExpressionStatement = ExpressionStatement;
exports.AssignmentPattern = AssignmentPattern;
exports.AssignmentExpression = AssignmentExpression;
exports.BindExpression = BindExpression;
exports.MemberExpression = MemberExpression;
exports.MetaProperty = MetaProperty;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _isInteger = require("is-integer");

var _isInteger2 = _interopRequireDefault(_isInteger);

var _lodashLangIsNumber = require("lodash/lang/isNumber");

var _lodashLangIsNumber2 = _interopRequireDefault(_lodashLangIsNumber);

var _node = require("../node");

var _node2 = _interopRequireDefault(_node);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * RegExp for testing scientific notation in literals.
 */

var SCIENTIFIC_NOTATION = /e/i;
var ZERO_DECIMAL_INTEGER = /\.0+$/;

/**
 * RegExp for testing if a numeric literal is
 * a BinaryIntegerLiteral, OctalIntegerLiteral or HexIntegerLiteral.
 */

var NON_DECIMAL_NUMERIC_LITERAL = /^0(b|o|x)/i;

/**
 * Prints UnaryExpression, prints operator and argument.
 */

function UnaryExpression(node, print) {
  var needsSpace = /[a-z]$/.test(node.operator);
  var arg = node.argument;

  if (t.isUpdateExpression(arg) || t.isUnaryExpression(arg)) {
    needsSpace = true;
  }

  if (t.isUnaryExpression(arg) && arg.operator === "!") {
    needsSpace = false;
  }

  this.push(node.operator);
  if (needsSpace) this.push(" ");
  print.plain(node.argument);
}

/**
 * Prints DoExpression, prints body.
 */

function DoExpression(node, print) {
  this.push("do");
  this.space();
  print.plain(node.body);
}

/**
 * Prints ParenthesizedExpression, prints expression.
 */

function ParenthesizedExpression(node, print) {
  this.push("(");
  print.plain(node.expression);
  this.push(")");
}

/**
 * Prints UpdateExpression, prints operator and argument.
 */

function UpdateExpression(node, print) {
  if (node.prefix) {
    this.push(node.operator);
    print.plain(node.argument);
  } else {
    print.plain(node.argument);
    this.push(node.operator);
  }
}

/**
 * Prints ConditionalExpression, prints test, consequent, and alternate.
 */

function ConditionalExpression(node, print) {
  print.plain(node.test);
  this.space();
  this.push("?");
  this.space();
  print.plain(node.consequent);
  this.space();
  this.push(":");
  this.space();
  print.plain(node.alternate);
}

/**
 * Prints NewExpression, prints callee and arguments.
 */

function NewExpression(node, print) {
  this.push("new ");
  print.plain(node.callee);
  this.push("(");
  print.list(node.arguments);
  this.push(")");
}

/**
 * Prints SequenceExpression.expressions.
 */

function SequenceExpression(node, print) {
  print.list(node.expressions);
}

/**
 * Prints ThisExpression.
 */

function ThisExpression() {
  this.push("this");
}

/**
 * Prints Super.
 */

function Super() {
  this.push("super");
}

/**
 * Prints Decorator, prints expression.
 */

function Decorator(node, print) {
  this.push("@");
  print.plain(node.expression);
  this.newline();
}

/**
 * Prints CallExpression, prints callee and arguments.
 */

function CallExpression(node, print) {
  print.plain(node.callee);

  this.push("(");

  var isPrettyCall = node._prettyCall && !this.format.retainLines && !this.format.compact;

  var separator;
  if (isPrettyCall) {
    separator = ",\n";
    this.newline();
    this.indent();
  }

  print.list(node.arguments, { separator: separator });

  if (isPrettyCall) {
    this.newline();
    this.dedent();
  }

  this.push(")");
}

/**
 * Builds yield or await expression printer.
 * Prints delegate, all, and argument.
 */

var buildYieldAwait = function buildYieldAwait(keyword) {
  return function (node, print) {
    this.push(keyword);

    if (node.delegate || node.all) {
      this.push("*");
    }

    if (node.argument) {
      this.push(" ");
      var terminatorState = this.startTerminatorless();
      print.plain(node.argument);
      this.endTerminatorless(terminatorState);
    }
  };
};

/**
 * Create YieldExpression and AwaitExpression printers.
 */

var YieldExpression = buildYieldAwait("yield");
exports.YieldExpression = YieldExpression;
var AwaitExpression = buildYieldAwait("await");

exports.AwaitExpression = AwaitExpression;
/**
 * Prints EmptyStatement.
 */

function EmptyStatement() {
  this.semicolon();
}

/**
 * Prints ExpressionStatement, prints expression.
 */

function ExpressionStatement(node, print) {
  print.plain(node.expression);
  this.semicolon();
}

/**
 * Prints AssignmentPattern, prints left and right.
 */

function AssignmentPattern(node, print) {
  print.plain(node.left);
  this.push(" = ");
  print.plain(node.right);
}

/**
 * Prints AssignmentExpression, prints left, operator, and right.
 */

function AssignmentExpression(node, print, parent) {
  // Somewhere inside a for statement `init` node but doesn't usually
  // needs a paren except for `in` expressions: `for (a in b ? a : b;;)`
  var parens = this._inForStatementInit && node.operator === "in" && !_node2["default"].needsParens(node, parent);

  if (parens) {
    this.push("(");
  }

  // todo: add cases where the spaces can be dropped when in compact mode
  print.plain(node.left);

  var spaces = node.operator === "in" || node.operator === "instanceof";
  spaces = true; // todo: https://github.com/babel/babel/issues/1835
  this.space(spaces);

  this.push(node.operator);

  if (!spaces) {
    // space is mandatory to avoid outputting <!--
    // http://javascript.spec.whatwg.org/#comment-syntax
    spaces = node.operator === "<" && t.isUnaryExpression(node.right, { prefix: true, operator: "!" }) && t.isUnaryExpression(node.right.argument, { prefix: true, operator: "--" });
  }

  this.space(spaces);

  print.plain(node.right);

  if (parens) {
    this.push(")");
  }
}

/**
 * Prints BindExpression, prints object and callee.
 */

function BindExpression(node, print) {
  print.plain(node.object);
  this.push("::");
  print.plain(node.callee);
}

/**
 * Alias ClassDeclaration printer as ClassExpression,
 * and AssignmentExpression printer as LogicalExpression.
 */

exports.BinaryExpression = AssignmentExpression;
exports.LogicalExpression = AssignmentExpression;

/**
 * Print MemberExpression, prints object, property, and value. Handles computed.
 */

function MemberExpression(node, print) {
  var obj = node.object;
  print.plain(obj);

  if (!node.computed && t.isMemberExpression(node.property)) {
    throw new TypeError("Got a MemberExpression for MemberExpression property");
  }

  var computed = node.computed;
  if (t.isLiteral(node.property) && _lodashLangIsNumber2["default"](node.property.value)) {
    computed = true;
  }

  if (computed) {
    this.push("[");
    print.plain(node.property);
    this.push("]");
  } else {
    if (t.isLiteral(node.object)) {
      var val = this._Literal(node.object);
      if (_isInteger2["default"](+val) && !ZERO_DECIMAL_INTEGER.test(val) && !SCIENTIFIC_NOTATION.test(val) && !this.endsWith(".") && !NON_DECIMAL_NUMERIC_LITERAL.test(val)) {
        this.push(".");
      }
    }

    this.push(".");
    print.plain(node.property);
  }
}

/**
 * Print MetaProperty, prints meta and property.
 */

function MetaProperty(node, print) {
  print.plain(node.meta);
  this.push(".");
  print.plain(node.property);
}