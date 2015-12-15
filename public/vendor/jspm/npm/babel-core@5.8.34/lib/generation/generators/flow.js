/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.AnyTypeAnnotation = AnyTypeAnnotation;
exports.ArrayTypeAnnotation = ArrayTypeAnnotation;
exports.BooleanTypeAnnotation = BooleanTypeAnnotation;
exports.BooleanLiteralTypeAnnotation = BooleanLiteralTypeAnnotation;
exports.DeclareClass = DeclareClass;
exports.DeclareFunction = DeclareFunction;
exports.DeclareModule = DeclareModule;
exports.DeclareVariable = DeclareVariable;
exports.FunctionTypeAnnotation = FunctionTypeAnnotation;
exports.FunctionTypeParam = FunctionTypeParam;
exports.InterfaceExtends = InterfaceExtends;
exports._interfaceish = _interfaceish;
exports.InterfaceDeclaration = InterfaceDeclaration;
exports.IntersectionTypeAnnotation = IntersectionTypeAnnotation;
exports.MixedTypeAnnotation = MixedTypeAnnotation;
exports.NullableTypeAnnotation = NullableTypeAnnotation;
exports.NumberTypeAnnotation = NumberTypeAnnotation;
exports.StringLiteralTypeAnnotation = StringLiteralTypeAnnotation;
exports.StringTypeAnnotation = StringTypeAnnotation;
exports.TupleTypeAnnotation = TupleTypeAnnotation;
exports.TypeofTypeAnnotation = TypeofTypeAnnotation;
exports.TypeAlias = TypeAlias;
exports.TypeAnnotation = TypeAnnotation;
exports.TypeParameterInstantiation = TypeParameterInstantiation;
exports.ObjectTypeAnnotation = ObjectTypeAnnotation;
exports.ObjectTypeCallProperty = ObjectTypeCallProperty;
exports.ObjectTypeIndexer = ObjectTypeIndexer;
exports.ObjectTypeProperty = ObjectTypeProperty;
exports.QualifiedTypeIdentifier = QualifiedTypeIdentifier;
exports.UnionTypeAnnotation = UnionTypeAnnotation;
exports.TypeCastExpression = TypeCastExpression;
exports.VoidTypeAnnotation = VoidTypeAnnotation;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Prints AnyTypeAnnotation.
 */

function AnyTypeAnnotation() {
  this.push("any");
}

/**
 * Prints ArrayTypeAnnotation, prints elementType.
 */

function ArrayTypeAnnotation(node, print) {
  print.plain(node.elementType);
  this.push("[");
  this.push("]");
}

/**
 * Prints BooleanTypeAnnotation.
 */

function BooleanTypeAnnotation() {
  this.push("bool");
}

/**
 * Prints BooleanLiteralTypeAnnotation.
 */

function BooleanLiteralTypeAnnotation(node) {
  this.push(node.value ? "true" : "false");
}

/**
 * Prints DeclareClass, prints node.
 */

function DeclareClass(node, print) {
  this.push("declare class ");
  this._interfaceish(node, print);
}

/**
 * Prints DeclareFunction, prints id and id.typeAnnotation.
 */

function DeclareFunction(node, print) {
  this.push("declare function ");
  print.plain(node.id);
  print.plain(node.id.typeAnnotation.typeAnnotation);
  this.semicolon();
}

/**
 * Prints DeclareModule, prints id and body.
 */

function DeclareModule(node, print) {
  this.push("declare module ");
  print.plain(node.id);
  this.space();
  print.plain(node.body);
}

/**
 * Prints DeclareVariable, prints id and id.typeAnnotation.
 */

function DeclareVariable(node, print) {
  this.push("declare var ");
  print.plain(node.id);
  print.plain(node.id.typeAnnotation);
  this.semicolon();
}

/**
 * Prints FunctionTypeAnnotation, prints typeParameters, params, and rest.
 */

function FunctionTypeAnnotation(node, print, parent) {
  print.plain(node.typeParameters);
  this.push("(");
  print.list(node.params);

  if (node.rest) {
    if (node.params.length) {
      this.push(",");
      this.space();
    }
    this.push("...");
    print.plain(node.rest);
  }

  this.push(")");

  // this node type is overloaded, not sure why but it makes it EXTREMELY annoying
  if (parent.type === "ObjectTypeProperty" || parent.type === "ObjectTypeCallProperty" || parent.type === "DeclareFunction") {
    this.push(":");
  } else {
    this.space();
    this.push("=>");
  }

  this.space();
  print.plain(node.returnType);
}

/**
 * Prints FunctionTypeParam, prints name and typeAnnotation, handles optional.
 */

function FunctionTypeParam(node, print) {
  print.plain(node.name);
  if (node.optional) this.push("?");
  this.push(":");
  this.space();
  print.plain(node.typeAnnotation);
}

/**
 * Prints InterfaceExtends, prints id and typeParameters.
 */

function InterfaceExtends(node, print) {
  print.plain(node.id);
  print.plain(node.typeParameters);
}

/**
 * Alias InterfaceExtends printer as ClassImplements,
 * and InterfaceExtends printer as GenericTypeAnnotation.
 */

exports.ClassImplements = InterfaceExtends;
exports.GenericTypeAnnotation = InterfaceExtends;

/**
 * Prints interface-like node, prints id, typeParameters, extends, and body.
 */

function _interfaceish(node, print) {
  print.plain(node.id);
  print.plain(node.typeParameters);
  if (node["extends"].length) {
    this.push(" extends ");
    print.join(node["extends"], { separator: ", " });
  }
  this.space();
  print.plain(node.body);
}

/**
 * Prints InterfaceDeclaration, prints node.
 */

function InterfaceDeclaration(node, print) {
  this.push("interface ");
  this._interfaceish(node, print);
}

/**
 * Prints IntersectionTypeAnnotation, prints types.
 */

function IntersectionTypeAnnotation(node, print) {
  print.join(node.types, { separator: " & " });
}

/**
 * Prints MixedTypeAnnotation.
 */

function MixedTypeAnnotation() {
  this.push("mixed");
}

/**
 * Prints NullableTypeAnnotation, prints typeAnnotation.
 */

function NullableTypeAnnotation(node, print) {
  this.push("?");
  print.plain(node.typeAnnotation);
}

/**
 * Prints NumberLiteralTypeAnnotation, prints value.
 */

var _types2 = require("./types");

exports.NumberLiteralTypeAnnotation = _types2.Literal;

/**
 * Prints NumberTypeAnnotation.
 */

function NumberTypeAnnotation() {
  this.push("number");
}

/**
 * Prints StringLiteralTypeAnnotation, prints value.
 */

function StringLiteralTypeAnnotation(node) {
  this.push(this._stringLiteral(node.value));
}

/**
 * Prints StringTypeAnnotation.
 */

function StringTypeAnnotation() {
  this.push("string");
}

/**
 * Prints TupleTypeAnnotation, prints types.
 */

function TupleTypeAnnotation(node, print) {
  this.push("[");
  print.join(node.types, { separator: ", " });
  this.push("]");
}

/**
 * Prints TypeofTypeAnnotation, prints argument.
 */

function TypeofTypeAnnotation(node, print) {
  this.push("typeof ");
  print.plain(node.argument);
}

/**
 * Prints TypeAlias, prints id, typeParameters, and right.
 */

function TypeAlias(node, print) {
  this.push("type ");
  print.plain(node.id);
  print.plain(node.typeParameters);
  this.space();
  this.push("=");
  this.space();
  print.plain(node.right);
  this.semicolon();
}

/**
 * Prints TypeAnnotation, prints typeAnnotation, handles optional.
 */

function TypeAnnotation(node, print) {
  this.push(":");
  this.space();
  if (node.optional) this.push("?");
  print.plain(node.typeAnnotation);
}

/**
 * Prints TypeParameterInstantiation, prints params.
 */

function TypeParameterInstantiation(node, print) {
  this.push("<");
  print.join(node.params, {
    separator: ", ",
    iterator: function iterator(node) {
      print.plain(node.typeAnnotation);
    }
  });
  this.push(">");
}

/**
 * Alias TypeParameterInstantiation printer as TypeParameterDeclaration
 */

exports.TypeParameterDeclaration = TypeParameterInstantiation;

/**
 * Prints ObjectTypeAnnotation, prints properties, callProperties, and indexers.
 */

function ObjectTypeAnnotation(node, print) {
  // istanbul ignore next

  var _this = this;

  this.push("{");
  var props = node.properties.concat(node.callProperties, node.indexers);

  if (props.length) {
    this.space();

    print.list(props, {
      separator: false,
      indent: true,
      iterator: function iterator() {
        if (props.length !== 1) {
          _this.semicolon();
          _this.space();
        }
      }
    });

    this.space();
  }

  this.push("}");
}

/**
 * Prints ObjectTypeCallProperty, prints value, handles static.
 */

function ObjectTypeCallProperty(node, print) {
  if (node["static"]) this.push("static ");
  print.plain(node.value);
}

/**
 * Prints ObjectTypeIndexer, prints id, key, and value, handles static.
 */

function ObjectTypeIndexer(node, print) {
  if (node["static"]) this.push("static ");
  this.push("[");
  print.plain(node.id);
  this.push(":");
  this.space();
  print.plain(node.key);
  this.push("]");
  this.push(":");
  this.space();
  print.plain(node.value);
}

/**
 * Prints ObjectTypeProperty, prints static, key, and value.
 */

function ObjectTypeProperty(node, print) {
  if (node["static"]) this.push("static ");
  print.plain(node.key);
  if (node.optional) this.push("?");
  if (!t.isFunctionTypeAnnotation(node.value)) {
    this.push(":");
    this.space();
  }
  print.plain(node.value);
}

/**
 * Prints QualifiedTypeIdentifier, prints qualification and id.
 */

function QualifiedTypeIdentifier(node, print) {
  print.plain(node.qualification);
  this.push(".");
  print.plain(node.id);
}

/**
 * Prints UnionTypeAnnotation, prints types.
 */

function UnionTypeAnnotation(node, print) {
  print.join(node.types, { separator: " | " });
}

/**
 * Prints TypeCastExpression, prints expression and typeAnnotation.
 */

function TypeCastExpression(node, print) {
  this.push("(");
  print.plain(node.expression);
  print.plain(node.typeAnnotation);
  this.push(")");
}

/**
 * Prints VoidTypeAnnotation.
 */

function VoidTypeAnnotation() {
  this.push("void");
}