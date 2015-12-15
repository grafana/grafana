/* */ 
"format cjs";
/* eslint eqeqeq: 0 */

"use strict";

exports.__esModule = true;
exports.evaluateTruthy = evaluateTruthy;
exports.evaluate = evaluate;
var VALID_CALLEES = ["String", "Number", "Math"];

/**
 * Walk the input `node` and statically evaluate if it's truthy.
 *
 * Returning `true` when we're sure that the expression will evaluate to a
 * truthy value, `false` if we're sure that it will evaluate to a falsy
 * value and `undefined` if we aren't sure. Because of this please do not
 * rely on coercion when using this method and check with === if it's false.
 *
 * For example do:
 *
 *   if (t.evaluateTruthy(node) === false) falsyLogic();
 *
 * **AND NOT**
 *
 *   if (!t.evaluateTruthy(node)) falsyLogic();
 *
 */

function evaluateTruthy() {
  var res = this.evaluate();
  if (res.confident) return !!res.value;
}

/**
 * Walk the input `node` and statically evaluate it.
 *
 * Returns an object in the form `{ confident, value }`. `confident` indicates
 * whether or not we had to drop out of evaluating the expression because of
 * hitting an unknown node that we couldn't confidently find the value of.
 *
 * Example:
 *
 *   t.evaluate(parse("5 + 5")) // { confident: true, value: 10 }
 *   t.evaluate(parse("!true")) // { confident: true, value: false }
 *   t.evaluate(parse("foo + foo")) // { confident: false, value: undefined }
 *
 */

function evaluate() {
  var confident = true;

  var value = evaluate(this);
  if (!confident) value = undefined;
  return {
    confident: confident,
    value: value
  };

  function evaluate(path) {
    if (!confident) return;

    var node = path.node;

    if (path.isSequenceExpression()) {
      var exprs = path.get("expressions");
      return evaluate(exprs[exprs.length - 1]);
    }

    if (path.isLiteral()) {
      if (node.regex) {
        // we have a regex and we can't represent it natively
      } else {
          return node.value;
        }
    }

    if (path.isConditionalExpression()) {
      if (evaluate(path.get("test"))) {
        return evaluate(path.get("consequent"));
      } else {
        return evaluate(path.get("alternate"));
      }
    }

    if (path.isTypeCastExpression()) {
      return evaluate(path.get("expression"));
    }

    if (path.isIdentifier() && !path.scope.hasBinding(node.name, true)) {
      if (node.name === "undefined") {
        return undefined;
      } else if (node.name === "Infinity") {
        return Infinity;
      } else if (node.name === "NaN") {
        return NaN;
      }
    }

    // "foo".length
    if (path.isMemberExpression() && !path.parentPath.isCallExpression({ callee: node })) {
      var _property = path.get("property");
      var object = path.get("object");

      if (object.isLiteral() && _property.isIdentifier()) {
        var _value = object.node.value;
        var type = typeof _value;
        if (type === "number" || type === "string") {
          return _value[_property.node.name];
        }
      }
    }

    if (path.isReferencedIdentifier()) {
      var binding = path.scope.getBinding(node.name);
      if (binding && binding.hasValue) {
        return binding.value;
      } else {
        var resolved = path.resolve();
        if (resolved === path) {
          return confident = false;
        } else {
          return evaluate(resolved);
        }
      }
    }

    if (path.isUnaryExpression({ prefix: true })) {
      var argument = path.get("argument");
      var arg = evaluate(argument);
      switch (node.operator) {
        case "void":
          return undefined;
        case "!":
          return !arg;
        case "+":
          return +arg;
        case "-":
          return -arg;
        case "~":
          return ~arg;
        case "typeof":
          if (argument.isFunction()) {
            return "function";
          } else {
            return typeof arg;
          }
      }
    }

    if (path.isArrayExpression() || path.isObjectExpression()) {
      // we could evaluate these but it's probably impractical and not very useful
    }

    if (path.isLogicalExpression()) {
      // If we are confident that one side of an && is false, or one side of
      // an || is true, we can be confident about the entire expression
      var wasConfident = confident;
      var left = evaluate(path.get("left"));
      var leftConfident = confident;
      confident = wasConfident;
      var right = evaluate(path.get("right"));
      var rightConfident = confident;
      var uncertain = leftConfident !== rightConfident;
      confident = leftConfident && rightConfident;

      switch (node.operator) {
        case "||":
          if ((left || right) && uncertain) {
            confident = true;
          }
          return left || right;
        case "&&":
          if (!left && leftConfident || !right && rightConfident) {
            confident = true;
          }
          return left && right;
      }
    }

    if (path.isBinaryExpression()) {
      var left = evaluate(path.get("left"));
      var right = evaluate(path.get("right"));

      switch (node.operator) {
        case "-":
          return left - right;
        case "+":
          return left + right;
        case "/":
          return left / right;
        case "*":
          return left * right;
        case "%":
          return left % right;
        case "**":
          return Math.pow(left, right);
        case "<":
          return left < right;
        case ">":
          return left > right;
        case "<=":
          return left <= right;
        case ">=":
          return left >= right;
        case "==":
          return left == right;
        case "!=":
          return left != right;
        case "===":
          return left === right;
        case "!==":
          return left !== right;
        case "|":
          return left | right;
        case "&":
          return left & right;
        case "^":
          return left ^ right;
        case "<<":
          return left << right;
        case ">>":
          return left >> right;
        case ">>>":
          return left >>> right;
      }
    }

    if (path.isCallExpression()) {
      var callee = path.get("callee");
      var context;
      var func;

      // Number(1);
      if (callee.isIdentifier() && !path.scope.getBinding(callee.node.name, true) && VALID_CALLEES.indexOf(callee.node.name) >= 0) {
        func = global[node.callee.name];
      }

      if (callee.isMemberExpression()) {
        var object = callee.get("object");
        var property = callee.get("property");

        // Math.min(1, 2)
        if (object.isIdentifier() && property.isIdentifier() && VALID_CALLEES.indexOf(object.node.name) >= 0) {
          context = global[object.node.name];
          func = context[property.node.name];
        }

        // "abc".charCodeAt(4)
        if (object.isLiteral() && property.isIdentifier()) {
          var type = typeof object.node.value;
          if (type === "string" || type === "number") {
            context = object.node.value;
            func = context[property.node.name];
          }
        }
      }

      if (func) {
        var args = path.get("arguments").map(evaluate);
        if (!confident) return;

        return func.apply(context, args);
      }
    }

    confident = false;
  }
}