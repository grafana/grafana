/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _explodeAssignableExpression = require("./explode-assignable-expression");

var _explodeAssignableExpression2 = _interopRequireDefault(_explodeAssignableExpression);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

exports["default"] = function (exports, opts) {

  /**
   * [Please add a description.]
   */

  var buildAssignment = function buildAssignment(left, right) {
    return t.assignmentExpression("=", left, right);
  };

  /**
   * [Please add a description.]
   */

  exports.ExpressionStatement = function (node, parent, scope, file) {
    // hit the `AssignmentExpression` one below
    if (this.isCompletionRecord()) return;

    var expr = node.expression;
    if (!opts.is(expr, file)) return;

    var nodes = [];

    var exploded = _explodeAssignableExpression2["default"](expr.left, nodes, file, scope);

    nodes.push(t.ifStatement(opts.build(exploded.uid, file), t.expressionStatement(buildAssignment(exploded.ref, expr.right))));

    return nodes;
  };

  /**
   * [Please add a description.]
   */

  exports.AssignmentExpression = function (node, parent, scope, file) {
    if (!opts.is(node, file)) return;

    var nodes = [];
    var exploded = _explodeAssignableExpression2["default"](node.left, nodes, file, scope);

    nodes.push(t.logicalExpression("&&", opts.build(exploded.uid, file), buildAssignment(exploded.ref, node.right)));

    // todo: duplicate expression node
    nodes.push(exploded.ref);

    return nodes;
  };
};

module.exports = exports["default"];