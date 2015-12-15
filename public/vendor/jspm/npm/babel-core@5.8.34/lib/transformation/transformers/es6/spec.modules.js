/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  group: "builtin-pre",
  optional: true
};

exports.metadata = metadata;
var visitor = {
  Program: function Program() {
    var id = this.scope.generateUidIdentifier("null");
    this.unshiftContainer("body", [t.variableDeclaration("var", [t.variableDeclarator(id, t.literal(null))]), t.exportNamedDeclaration(null, [t.exportSpecifier(id, t.identifier("__proto__"))])]);
  }
};
exports.visitor = visitor;