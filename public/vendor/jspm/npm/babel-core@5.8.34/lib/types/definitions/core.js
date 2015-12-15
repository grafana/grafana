/* */ 
"format cjs";
"use strict";

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

_index2["default"]("ArrayExpression", {
  visitor: ["elements"],
  aliases: ["Expression"]
});

_index2["default"]("AssignmentExpression", {
  builder: ["operator", "left", "right"],
  visitor: ["left", "right"],
  aliases: ["Expression"]
});

_index2["default"]("BinaryExpression", {
  builder: ["operator", "left", "right"],
  visitor: ["left", "right"],
  aliases: ["Binary", "Expression"]
});

_index2["default"]("BlockStatement", {
  visitor: ["body"],
  aliases: ["Scopable", "BlockParent", "Block", "Statement"]
});

_index2["default"]("BreakStatement", {
  visitor: ["label"],
  aliases: ["Statement", "Terminatorless", "CompletionStatement"]
});

_index2["default"]("CallExpression", {
  visitor: ["callee", "arguments"],
  aliases: ["Expression"]
});

_index2["default"]("CatchClause", {
  visitor: ["param", "body"],
  aliases: ["Scopable"]
});

_index2["default"]("ConditionalExpression", {
  visitor: ["test", "consequent", "alternate"],
  aliases: ["Expression"]
});

_index2["default"]("ContinueStatement", {
  visitor: ["label"],
  aliases: ["Statement", "Terminatorless", "CompletionStatement"]
});

_index2["default"]("DebuggerStatement", {
  aliases: ["Statement"]
});

_index2["default"]("DoWhileStatement", {
  visitor: ["body", "test"],
  aliases: ["Statement", "BlockParent", "Loop", "While", "Scopable"]
});

_index2["default"]("EmptyStatement", {
  aliases: ["Statement"]
});

_index2["default"]("ExpressionStatement", {
  visitor: ["expression"],
  aliases: ["Statement"]
});

_index2["default"]("File", {
  builder: ["program", "comments", "tokens"],
  visitor: ["program"]
});

_index2["default"]("ForInStatement", {
  visitor: ["left", "right", "body"],
  aliases: ["Scopable", "Statement", "For", "BlockParent", "Loop", "ForXStatement"]
});

_index2["default"]("ForStatement", {
  visitor: ["init", "test", "update", "body"],
  aliases: ["Scopable", "Statement", "For", "BlockParent", "Loop"]
});

_index2["default"]("FunctionDeclaration", {
  builder: {
    id: null,
    params: null,
    body: null,
    generator: false,
    async: false
  },
  visitor: ["id", "params", "body", "returnType", "typeParameters"],
  aliases: ["Scopable", "Function", "Func", "BlockParent", "FunctionParent", "Statement", "Pure", "Declaration"]
});

_index2["default"]("FunctionExpression", {
  builder: {
    id: null,
    params: null,
    body: null,
    generator: false,
    async: false
  },
  visitor: ["id", "params", "body", "returnType", "typeParameters"],
  aliases: ["Scopable", "Function", "Func", "BlockParent", "FunctionParent", "Expression", "Pure"]
});

_index2["default"]("Identifier", {
  builder: ["name"],
  visitor: ["typeAnnotation"],
  aliases: ["Expression"]
});

_index2["default"]("IfStatement", {
  visitor: ["test", "consequent", "alternate"],
  aliases: ["Statement"]
});

_index2["default"]("LabeledStatement", {
  visitor: ["label", "body"],
  aliases: ["Statement"]
});

_index2["default"]("Literal", {
  builder: ["value"],
  aliases: ["Expression", "Pure"]
});

_index2["default"]("LogicalExpression", {
  builder: ["operator", "left", "right"],
  visitor: ["left", "right"],
  aliases: ["Binary", "Expression"]
});

_index2["default"]("MemberExpression", {
  builder: {
    object: null,
    property: null,
    computed: false
  },
  visitor: ["object", "property"],
  aliases: ["Expression"]
});

_index2["default"]("NewExpression", {
  visitor: ["callee", "arguments"],
  aliases: ["Expression"]
});

_index2["default"]("ObjectExpression", {
  visitor: ["properties"],
  aliases: ["Expression"]
});

_index2["default"]("Program", {
  visitor: ["body"],
  aliases: ["Scopable", "BlockParent", "Block", "FunctionParent"]
});

_index2["default"]("Property", {
  builder: {
    kind: "init",
    key: null,
    value: null,
    computed: false
  },
  visitor: ["key", "value", "decorators"],
  aliases: ["UserWhitespacable"]
});

_index2["default"]("RestElement", {
  visitor: ["argument", "typeAnnotation"]
});

_index2["default"]("ReturnStatement", {
  visitor: ["argument"],
  aliases: ["Statement", "Terminatorless", "CompletionStatement"]
});

_index2["default"]("SequenceExpression", {
  visitor: ["expressions"],
  aliases: ["Expression"]
});

_index2["default"]("SwitchCase", {
  visitor: ["test", "consequent"]
});

_index2["default"]("SwitchStatement", {
  visitor: ["discriminant", "cases"],
  aliases: ["Statement", "BlockParent", "Scopable"]
});

_index2["default"]("ThisExpression", {
  aliases: ["Expression"]
});

_index2["default"]("ThrowStatement", {
  visitor: ["argument"],
  aliases: ["Statement", "Terminatorless", "CompletionStatement"]
});

_index2["default"]("TryStatement", {
  builder: ["block", "handler", "finalizer"],
  visitor: ["block", "handlers", "handler", "guardedHandlers", "finalizer"],
  aliases: ["Statement"]
});

_index2["default"]("UnaryExpression", {
  builder: {
    operator: null,
    argument: null,
    prefix: false
  },
  visitor: ["argument"],
  aliases: ["UnaryLike", "Expression"]
});

_index2["default"]("UpdateExpression", {
  builder: {
    operator: null,
    argument: null,
    prefix: false
  },
  visitor: ["argument"],
  aliases: ["Expression"]
});

_index2["default"]("VariableDeclaration", {
  builder: ["kind", "declarations"],
  visitor: ["declarations"],
  aliases: ["Statement", "Declaration"]
});

_index2["default"]("VariableDeclarator", {
  visitor: ["id", "init"]
});

_index2["default"]("WhileStatement", {
  visitor: ["test", "body"],
  aliases: ["Statement", "BlockParent", "Loop", "While", "Scopable"]
});

_index2["default"]("WithStatement", {
  visitor: ["object", "body"],
  aliases: ["Statement"]
});