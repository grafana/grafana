/* */ 
"format cjs";
"use strict";

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

_index2["default"]("Noop", {
  visitor: []
});

_index2["default"]("ParenthesizedExpression", {
  visitor: ["expression"],
  aliases: ["Expression"]
});