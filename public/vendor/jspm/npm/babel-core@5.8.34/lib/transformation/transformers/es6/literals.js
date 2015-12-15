/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
var metadata = {
  group: "builtin-pre"
};

exports.metadata = metadata;
var visitor = {
  Literal: function Literal(node) {
    // number octal like 0b10 or 0o70
    if (typeof node.value === "number" && /^0[ob]/i.test(node.raw)) {
      node.raw = undefined;
    }

    // unicode escape
    if (typeof node.value === "string" && /\\[u]/gi.test(node.raw)) {
      node.raw = undefined;
    }
  }
};
exports.visitor = visitor;