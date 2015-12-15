/* */ 
"format cjs";
"use strict";

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

_index2["default"]("JSXAttribute", {
  visitor: ["name", "value"],
  aliases: ["JSX", "Immutable"]
});

_index2["default"]("JSXClosingElement", {
  visitor: ["name"],
  aliases: ["JSX", "Immutable"]
});

_index2["default"]("JSXElement", {
  visitor: ["openingElement", "closingElement", "children"],
  aliases: ["JSX", "Immutable", "Expression"]
});

_index2["default"]("JSXEmptyExpression", {
  aliases: ["JSX", "Expression"]
});

_index2["default"]("JSXExpressionContainer", {
  visitor: ["expression"],
  aliases: ["JSX", "Immutable"]
});

_index2["default"]("JSXIdentifier", {
  aliases: ["JSX", "Expression"]
});

_index2["default"]("JSXMemberExpression", {
  visitor: ["object", "property"],
  aliases: ["JSX", "Expression"]
});

_index2["default"]("JSXNamespacedName", {
  visitor: ["namespace", "name"],
  aliases: ["JSX"]
});

_index2["default"]("JSXOpeningElement", {
  visitor: ["name", "attributes"],
  aliases: ["JSX", "Immutable"]
});

_index2["default"]("JSXSpreadAttribute", {
  visitor: ["argument"],
  aliases: ["JSX"]
});