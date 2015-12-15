/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _messages = require("../../../messages");

var messages = _interopRequireWildcard(_messages);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

// check if the input Literal `source` is an alternate casing of "react"
function check(source, file) {
  if (t.isLiteral(source)) {
    var name = source.value;
    var lower = name.toLowerCase();

    if (lower === "react" && name !== lower) {
      throw file.errorWithNode(source, messages.get("didYouMean", "react"));
    }
  }
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  CallExpression: function CallExpression(node, parent, scope, file) {
    if (this.get("callee").isIdentifier({ name: "require" }) && node.arguments.length === 1) {
      check(node.arguments[0], file);
    }
  },

  /**
   * [Please add a description.]
   */

  ModuleDeclaration: function ModuleDeclaration(node, parent, scope, file) {
    check(node.source, file);
  }
};
exports.visitor = visitor;