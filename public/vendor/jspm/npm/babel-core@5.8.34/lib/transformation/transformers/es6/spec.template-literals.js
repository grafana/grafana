/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  optional: true,
  group: "builtin-pre"
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  TemplateLiteral: function TemplateLiteral(node, parent) {
    if (t.isTaggedTemplateExpression(parent)) return;

    for (var i = 0; i < node.expressions.length; i++) {
      node.expressions[i] = t.callExpression(t.identifier("String"), [node.expressions[i]]);
    }
  }
};
exports.visitor = visitor;