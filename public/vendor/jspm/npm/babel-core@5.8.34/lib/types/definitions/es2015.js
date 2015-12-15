/* */ 
"format cjs";
"use strict";

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

_index2["default"]("AssignmentPattern", {
  visitor: ["left", "right"],
  aliases: ["Pattern"]
});

_index2["default"]("ArrayPattern", {
  visitor: ["elements", "typeAnnotation"],
  aliases: ["Pattern"]
});

_index2["default"]("ArrowFunctionExpression", {
  builder: ["params", "body", "async"],
  visitor: ["params", "body", "returnType"],
  aliases: ["Scopable", "Function", "Func", "BlockParent", "FunctionParent", "Expression", "Pure"]
});

_index2["default"]("ClassBody", {
  visitor: ["body"]
});

_index2["default"]("ClassDeclaration", {
  visitor: ["id", "body", "superClass", "typeParameters", "superTypeParameters", "implements", "decorators"],
  aliases: ["Scopable", "Class", "Statement", "Declaration"]
});

_index2["default"]("ClassExpression", {
  visitor: ["id", "body", "superClass", "typeParameters", "superTypeParameters", "implements", "decorators"],
  aliases: ["Scopable", "Class", "Expression"]
});

_index2["default"]("ExportAllDeclaration", {
  visitor: ["source", "exported"],
  aliases: ["Statement", "Declaration", "ModuleDeclaration", "ExportDeclaration"]
});

_index2["default"]("ExportDefaultDeclaration", {
  visitor: ["declaration"],
  aliases: ["Statement", "Declaration", "ModuleDeclaration", "ExportDeclaration"]
});

_index2["default"]("ExportNamedDeclaration", {
  visitor: ["declaration", "specifiers", "source"],
  aliases: ["Statement", "Declaration", "ModuleDeclaration", "ExportDeclaration"]
});

_index2["default"]("ExportDefaultSpecifier", {
  visitor: ["exported"],
  aliases: ["ModuleSpecifier"]
});

_index2["default"]("ExportNamespaceSpecifier", {
  visitor: ["exported"],
  aliases: ["ModuleSpecifier"]
});

_index2["default"]("ExportSpecifier", {
  visitor: ["local", "exported"],
  aliases: ["ModuleSpecifier"]
});

_index2["default"]("ForOfStatement", {
  visitor: ["left", "right", "body"],
  aliases: ["Scopable", "Statement", "For", "BlockParent", "Loop", "ForXStatement"]
});

_index2["default"]("ImportDeclaration", {
  visitor: ["specifiers", "source"],
  aliases: ["Statement", "Declaration", "ModuleDeclaration"]
});

_index2["default"]("ImportDefaultSpecifier", {
  visitor: ["local"],
  aliases: ["ModuleSpecifier"]
});

_index2["default"]("ImportNamespaceSpecifier", {
  visitor: ["local"],
  aliases: ["ModuleSpecifier"]
});

_index2["default"]("ImportSpecifier", {
  visitor: ["local", "imported"],
  aliases: ["ModuleSpecifier"]
});

_index2["default"]("MetaProperty", {
  visitor: ["meta", "property"],
  aliases: ["Expression"]
});

_index2["default"]("MethodDefinition", {
  builder: {
    key: null,
    value: null,
    kind: "method",
    computed: false,
    "static": false
  },
  visitor: ["key", "value", "decorators"]
});

_index2["default"]("ObjectPattern", {
  visitor: ["properties", "typeAnnotation"],
  aliases: ["Pattern"]
});

_index2["default"]("SpreadElement", {
  visitor: ["argument"],
  aliases: ["UnaryLike"]
});

_index2["default"]("Super", {
  aliases: ["Expression"]
});

_index2["default"]("TaggedTemplateExpression", {
  visitor: ["tag", "quasi"],
  aliases: ["Expression"]
});

_index2["default"]("TemplateElement");

_index2["default"]("TemplateLiteral", {
  visitor: ["quasis", "expressions"],
  aliases: ["Expression"]
});

_index2["default"]("YieldExpression", {
  builder: ["argument", "delegate"],
  visitor: ["argument"],
  aliases: ["Expression", "Terminatorless"]
});