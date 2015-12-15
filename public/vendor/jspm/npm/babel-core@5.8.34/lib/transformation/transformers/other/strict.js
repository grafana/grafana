/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  group: "builtin-pre"
};

exports.metadata = metadata;
var THIS_BREAK_KEYS = ["FunctionExpression", "FunctionDeclaration", "ClassProperty"];

function isUseStrict(node) {
  if (!t.isLiteral(node)) return false;

  if (node.raw && node.rawValue === node.value) {
    return node.rawValue === "use strict";
  } else {
    return node.value === "use strict";
  }
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Program: {
    enter: function enter(program) {
      var first = program.body[0];

      var directive;
      if (t.isExpressionStatement(first) && isUseStrict(first.expression)) {
        directive = first;
      } else {
        directive = t.expressionStatement(t.literal("use strict"));
        this.unshiftContainer("body", directive);
        if (first) {
          directive.leadingComments = first.leadingComments;
          first.leadingComments = [];
        }
      }
      directive._blockHoist = Infinity;
    }
  },

  /**
   * [Please add a description.]
   */

  ThisExpression: function ThisExpression() {
    if (!this.findParent(function (path) {
      return !path.is("shadow") && THIS_BREAK_KEYS.indexOf(path.type) >= 0;
    })) {
      return t.identifier("undefined");
    }
  }
};
exports.visitor = visitor;