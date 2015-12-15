/* */ 
"format cjs";
"use strict";

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

_index2["default"]("AnyTypeAnnotation", {
  aliases: ["Flow", "FlowBaseAnnotation"]
});

_index2["default"]("ArrayTypeAnnotation", {
  visitor: ["elementType"],
  aliases: ["Flow"]
});

_index2["default"]("BooleanTypeAnnotation", {
  aliases: ["Flow", "FlowBaseAnnotation"]
});

_index2["default"]("BooleanLiteralTypeAnnotation", {
  aliases: ["Flow"]
});

_index2["default"]("ClassImplements", {
  visitor: ["id", "typeParameters"],
  aliases: ["Flow"]
});

_index2["default"]("ClassProperty", {
  visitor: ["key", "value", "typeAnnotation", "decorators"],
  aliases: ["Flow"]
});

_index2["default"]("DeclareClass", {
  visitor: ["id", "typeParameters", "extends", "body"],
  aliases: ["Flow", "FlowDeclaration", "Statement", "Declaration"]
});

_index2["default"]("DeclareFunction", {
  visitor: ["id"],
  aliases: ["Flow", "FlowDeclaration", "Statement", "Declaration"]
});

_index2["default"]("DeclareModule", {
  visitor: ["id", "body"],
  aliases: ["Flow", "FlowDeclaration", "Statement", "Declaration"]
});

_index2["default"]("DeclareVariable", {
  visitor: ["id"],
  aliases: ["Flow", "FlowDeclaration", "Statement", "Declaration"]
});

_index2["default"]("FunctionTypeAnnotation", {
  visitor: ["typeParameters", "params", "rest", "returnType"],
  aliases: ["Flow"]
});

_index2["default"]("FunctionTypeParam", {
  visitor: ["name", "typeAnnotation"],
  aliases: ["Flow"]
});

_index2["default"]("GenericTypeAnnotation", {
  visitor: ["id", "typeParameters"],
  aliases: ["Flow"]
});

_index2["default"]("InterfaceExtends", {
  visitor: ["id", "typeParameters"],
  aliases: ["Flow"]
});

_index2["default"]("InterfaceDeclaration", {
  visitor: ["id", "typeParameters", "extends", "body"],
  aliases: ["Flow", "FlowDeclaration", "Statement", "Declaration"]
});

_index2["default"]("IntersectionTypeAnnotation", {
  visitor: ["types"],
  aliases: ["Flow"]
});

_index2["default"]("MixedTypeAnnotation", {
  aliases: ["Flow", "FlowBaseAnnotation"]
});

_index2["default"]("NullableTypeAnnotation", {
  visitor: ["typeAnnotation"],
  aliases: ["Flow"]
});

_index2["default"]("NumberLiteralTypeAnnotation", {
  aliases: ["Flow"]
});

_index2["default"]("NumberTypeAnnotation", {
  aliases: ["Flow", "FlowBaseAnnotation"]
});

_index2["default"]("StringLiteralTypeAnnotation", {
  aliases: ["Flow"]
});

_index2["default"]("StringTypeAnnotation", {
  aliases: ["Flow", "FlowBaseAnnotation"]
});

_index2["default"]("TupleTypeAnnotation", {
  visitor: ["types"],
  aliases: ["Flow"]
});

_index2["default"]("TypeofTypeAnnotation", {
  visitor: ["argument"],
  aliases: ["Flow"]
});

_index2["default"]("TypeAlias", {
  visitor: ["id", "typeParameters", "right"],
  aliases: ["Flow", "FlowDeclaration", "Statement", "Declaration"]
});

_index2["default"]("TypeAnnotation", {
  visitor: ["typeAnnotation"],
  aliases: ["Flow"]
});

_index2["default"]("TypeCastExpression", {
  visitor: ["expression", "typeAnnotation"],
  aliases: ["Flow"]
});

_index2["default"]("TypeParameterDeclaration", {
  visitor: ["params"],
  aliases: ["Flow"]
});

_index2["default"]("TypeParameterInstantiation", {
  visitor: ["params"],
  aliases: ["Flow"]
});

_index2["default"]("ObjectTypeAnnotation", {
  visitor: ["properties", "indexers", "callProperties"],
  aliases: ["Flow"]
});

_index2["default"]("ObjectTypeCallProperty", {
  visitor: ["value"],
  aliases: ["Flow", "UserWhitespacable"]
});

_index2["default"]("ObjectTypeIndexer", {
  visitor: ["id", "key", "value"],
  aliases: ["Flow", "UserWhitespacable"]
});

_index2["default"]("ObjectTypeProperty", {
  visitor: ["key", "value"],
  aliases: ["Flow", "UserWhitespacable"]
});

_index2["default"]("QualifiedTypeIdentifier", {
  visitor: ["id", "qualification"],
  aliases: ["Flow"]
});

_index2["default"]("UnionTypeAnnotation", {
  visitor: ["types"],
  aliases: ["Flow"]
});

_index2["default"]("VoidTypeAnnotation", {
  aliases: ["Flow", "FlowBaseAnnotation"]
});