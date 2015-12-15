/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _messages = require("../../../messages");

var messages = _interopRequireWildcard(_messages);

/**
 * Turn constants into variables.
 * Ensure there are no constant violations in any scope.
 *
 * @example
 *
 * **In**
 *
 * ```javascript
 * const MULTIPLIER = 5;
 * ```
 *
 * **Out**
 *
 * ```javascript
 * var MULTIPLIER = 5;
 * ```
 */

var visitor = {

  /**
   * Look for any constants (or modules) in scope.
   * If they have any `constantViolations` throw an error.
   */

  Scope: function Scope(node, parent, scope) {
    for (var name in scope.bindings) {
      var binding = scope.bindings[name];

      // not a constant
      if (binding.kind !== "const" && binding.kind !== "module") continue;

      var _arr = binding.constantViolations;
      for (var _i = 0; _i < _arr.length; _i++) {
        var violation = _arr[_i];
        throw violation.errorWithNode(messages.get("readOnly", name));
      }
    }
  },

  /**
   * Look for constants.
   * Turn them into `let` variables.
   */

  VariableDeclaration: function VariableDeclaration(node) {
    if (node.kind === "const") node.kind = "let";
  }
};
exports.visitor = visitor;