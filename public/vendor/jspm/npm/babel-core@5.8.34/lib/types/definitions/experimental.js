/* */ 
"format cjs";
"use strict";

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

_index2["default"]("AwaitExpression", {
  builder: ["argument", "all"],
  visitor: ["argument"],
  aliases: ["Expression", "Terminatorless"]
});

_index2["default"]("BindExpression", {
  visitor: ["object", "callee"]
});

_index2["default"]("ComprehensionBlock", {
  visitor: ["left", "right"]
});

_index2["default"]("ComprehensionExpression", {
  visitor: ["filter", "blocks", "body"],
  aliases: ["Expression", "Scopable"]
});

_index2["default"]("Decorator", {
  visitor: ["expression"]
});

_index2["default"]("DoExpression", {
  visitor: ["body"],
  aliases: ["Expression"]
});

_index2["default"]("SpreadProperty", {
  visitor: ["argument"],
  aliases: ["UnaryLike"]
});