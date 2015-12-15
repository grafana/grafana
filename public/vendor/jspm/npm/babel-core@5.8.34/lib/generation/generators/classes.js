/* */ 
"format cjs";
/**
 * Print ClassDeclaration, prints decorators, typeParameters, extends, implements, and body.
 */

"use strict";

exports.__esModule = true;
exports.ClassDeclaration = ClassDeclaration;
exports.ClassBody = ClassBody;
exports.ClassProperty = ClassProperty;
exports.MethodDefinition = MethodDefinition;

function ClassDeclaration(node, print) {
  print.list(node.decorators, { separator: "" });
  this.push("class");

  if (node.id) {
    this.push(" ");
    print.plain(node.id);
  }

  print.plain(node.typeParameters);

  if (node.superClass) {
    this.push(" extends ");
    print.plain(node.superClass);
    print.plain(node.superTypeParameters);
  }

  if (node["implements"]) {
    this.push(" implements ");
    print.join(node["implements"], { separator: ", " });
  }

  this.space();
  print.plain(node.body);
}

/**
 * Alias ClassDeclaration printer as ClassExpression.
 */

exports.ClassExpression = ClassDeclaration;

/**
 * Print ClassBody, collapses empty blocks, prints body.
 */

function ClassBody(node, print) {
  this.push("{");
  if (node.body.length === 0) {
    print.printInnerComments();
    this.push("}");
  } else {
    this.newline();

    this.indent();
    print.sequence(node.body);
    this.dedent();

    this.rightBrace();
  }
}

/**
 * Print ClassProperty, prints decorators, static, key, typeAnnotation, and value.
 * Also: semicolons, deal with it.
 */

function ClassProperty(node, print) {
  print.list(node.decorators, { separator: "" });

  if (node["static"]) this.push("static ");
  print.plain(node.key);
  print.plain(node.typeAnnotation);
  if (node.value) {
    this.space();
    this.push("=");
    this.space();
    print.plain(node.value);
  }
  this.semicolon();
}

/**
 * Print MethodDefinition, prints decorations, static, and method.
 */

function MethodDefinition(node, print) {
  print.list(node.decorators, { separator: "" });

  if (node["static"]) {
    this.push("static ");
  }

  this._method(node, print);
}