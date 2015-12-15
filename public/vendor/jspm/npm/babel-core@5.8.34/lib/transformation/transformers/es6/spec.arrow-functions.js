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
  ArrowFunctionExpression: function ArrowFunctionExpression(node, parent, scope, file) {
    if (node.shadow) return;
    node.shadow = { "this": false };

    var boundThis = t.thisExpression();
    boundThis._forceShadow = this;

    // make sure that arrow function won't be instantiated
    t.ensureBlock(node);
    this.get("body").unshiftContainer("body", t.expressionStatement(t.callExpression(file.addHelper("new-arrow-check"), [t.thisExpression(), boundThis])));

    return t.callExpression(t.memberExpression(node, t.identifier("bind")), [t.thisExpression()]);
  }
};
exports.visitor = visitor;