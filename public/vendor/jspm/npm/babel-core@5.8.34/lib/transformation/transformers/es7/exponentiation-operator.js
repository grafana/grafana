/* */ 
"format cjs";
// https://github.com/rwaldron/exponentiation-operator

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _helpersBuildBinaryAssignmentOperatorTransformer = require("../../helpers/build-binary-assignment-operator-transformer");

var _helpersBuildBinaryAssignmentOperatorTransformer2 = _interopRequireDefault(_helpersBuildBinaryAssignmentOperatorTransformer);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  stage: 3
};

exports.metadata = metadata;
var MATH_POW = t.memberExpression(t.identifier("Math"), t.identifier("pow"));

/**
 * [Please add a description.]
 */

var visitor = _helpersBuildBinaryAssignmentOperatorTransformer2["default"]({
  operator: "**",

  /**
   * [Please add a description.]
   */

  build: function build(left, right) {
    return t.callExpression(MATH_POW, [left, right]);
  }
});
exports.visitor = visitor;