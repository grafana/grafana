/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports._params = _params;
exports._method = _method;
exports.FunctionExpression = FunctionExpression;
exports.ArrowFunctionExpression = ArrowFunctionExpression;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Prints nodes with params, prints typeParameters, params, and returnType, handles optional params.
 */

function _params(node, print) {
  // istanbul ignore next

  var _this = this;

  print.plain(node.typeParameters);
  this.push("(");
  print.list(node.params, {
    iterator: function iterator(node) {
      if (node.optional) _this.push("?");
      print.plain(node.typeAnnotation);
    }
  });
  this.push(")");

  if (node.returnType) {
    print.plain(node.returnType);
  }
}

/**
 * Prints method-like nodes, prints key, value, and body, handles async, generator, computed, and get or set.
 */

function _method(node, print) {
  var value = node.value;
  var kind = node.kind;
  var key = node.key;

  if (kind === "method" || kind === "init") {
    if (value.generator) {
      this.push("*");
    }
  }

  if (kind === "get" || kind === "set") {
    this.push(kind + " ");
  }

  if (value.async) this.push("async ");

  if (node.computed) {
    this.push("[");
    print.plain(key);
    this.push("]");
  } else {
    print.plain(key);
  }

  this._params(value, print);
  this.space();
  print.plain(value.body);
}

/**
 * Prints FunctionExpression, prints id and body, handles async and generator.
 */

function FunctionExpression(node, print) {
  if (node.async) this.push("async ");
  this.push("function");
  if (node.generator) this.push("*");

  if (node.id) {
    this.push(" ");
    print.plain(node.id);
  } else {
    this.space();
  }

  this._params(node, print);
  this.space();
  print.plain(node.body);
}

/**
 * Alias FunctionExpression printer as FunctionDeclaration.
 */

exports.FunctionDeclaration = FunctionExpression;

/**
 * Prints ArrowFunctionExpression, prints params and body, handles async.
 * Leaves out parentheses when single param.
 */

function ArrowFunctionExpression(node, print) {
  if (node.async) this.push("async ");

  if (node.params.length === 1 && t.isIdentifier(node.params[0])) {
    print.plain(node.params[0]);
  } else {
    this._params(node, print);
  }

  this.push(" => ");

  var bodyNeedsParens = t.isObjectExpression(node.body);

  if (bodyNeedsParens) {
    this.push("(");
  }

  print.plain(node.body);

  if (bodyNeedsParens) {
    this.push(")");
  }
}