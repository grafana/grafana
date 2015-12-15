/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  group: "builtin-trailing"
};

exports.metadata = metadata;
/**
 * Turn member expression reserved word properties into literals.
 *
 * @example
 *
 * **In**
 *
 * ```javascript
 * foo.catch;
 * ```
 *
 * **Out**
 *
 * ```javascript
 * foo["catch"];
 * ```
 */

var visitor = {

  /**
   * Look for non-computed properties with names that are not valid identifiers.
   * Turn them into computed properties with literal names.
   */

  MemberExpression: {
    exit: function exit(node) {
      var prop = node.property;
      if (!node.computed && t.isIdentifier(prop) && !t.isValidIdentifier(prop.name)) {
        // foo.default -> foo["default"]
        node.property = t.literal(prop.name);
        node.computed = true;
      }
    }
  }
};
exports.visitor = visitor;