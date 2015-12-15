/* */ 
"format cjs";
/* eslint quotes: 0 */

"use strict";

exports.__esModule = true;
exports.Identifier = Identifier;
exports.RestElement = RestElement;
exports.ObjectExpression = ObjectExpression;
exports.Property = Property;
exports.ArrayExpression = ArrayExpression;
exports.Literal = Literal;
exports._Literal = _Literal;
exports._stringLiteral = _stringLiteral;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Prints Identifier, prints name.
 */

function Identifier(node) {
  this.push(node.name);
}

/**
 * Prints RestElement, prints argument.
 */

function RestElement(node, print) {
  this.push("...");
  print.plain(node.argument);
}

/**
 * Alias RestElement printer as SpreadElement,
 * and RestElement printer as SpreadProperty.
 */

exports.SpreadElement = RestElement;
exports.SpreadProperty = RestElement;

/**
 * Prints ObjectExpression, prints properties.
 */

function ObjectExpression(node, print) {
  var props = node.properties;

  this.push("{");
  print.printInnerComments();

  if (props.length) {
    this.space();
    print.list(props, { indent: true });
    this.space();
  }

  this.push("}");
}

/**
 * Alias ObjectExpression printer as ObjectPattern.
 */

exports.ObjectPattern = ObjectExpression;

/**
 * Prints Property, prints decorators, key, and value, handles kind, computed, and shorthand.
 */

function Property(node, print) {
  print.list(node.decorators, { separator: "" });

  if (node.method || node.kind === "get" || node.kind === "set") {
    this._method(node, print);
  } else {
    if (node.computed) {
      this.push("[");
      print.plain(node.key);
      this.push("]");
    } else {
      // print `({ foo: foo = 5 } = {})` as `({ foo = 5 } = {});`
      if (t.isAssignmentPattern(node.value) && t.isIdentifier(node.key) && node.key.name === node.value.left.name) {
        print.plain(node.value);
        return;
      }

      print.plain(node.key);

      // shorthand!
      if (node.shorthand && t.isIdentifier(node.key) && t.isIdentifier(node.value) && node.key.name === node.value.name) {
        return;
      }
    }

    this.push(":");
    this.space();
    print.plain(node.value);
  }
}

/**
 * Prints ArrayExpression, prints elements.
 */

function ArrayExpression(node, print) {
  var elems = node.elements;
  var len = elems.length;

  this.push("[");
  print.printInnerComments();

  for (var i = 0; i < elems.length; i++) {
    var elem = elems[i];
    if (elem) {
      if (i > 0) this.space();
      print.plain(elem);
      if (i < len - 1) this.push(",");
    } else {
      // If the array expression ends with a hole, that hole
      // will be ignored by the interpreter, but if it ends with
      // two (or more) holes, we need to write out two (or more)
      // commas so that the resulting code is interpreted with
      // both (all) of the holes.
      this.push(",");
    }
  }

  this.push("]");
}

/**
 * Alias ArrayExpression printer as ArrayPattern.
 */

exports.ArrayPattern = ArrayExpression;

/**
 * Prints Literal, prints value, regex, raw, handles val type.
 */

function Literal(node) {
  this.push(""); // hack: catch up indentation
  this._push(this._Literal(node));
}

function _Literal(node) {
  var val = node.value;

  if (node.regex) {
    return "/" + node.regex.pattern + "/" + node.regex.flags;
  }

  // just use the raw property if our current value is equivalent to the one we got
  // when we populated raw
  if (node.raw != null && node.rawValue != null && val === node.rawValue) {
    return node.raw;
  }

  switch (typeof val) {
    case "string":
      return this._stringLiteral(val);

    case "number":
      return val + "";

    case "boolean":
      return val ? "true" : "false";

    default:
      if (val === null) {
        return "null";
      } else {
        throw new Error("Invalid Literal type");
      }
  }
}

/**
 * Prints string literals, handles format.
 */

function _stringLiteral(val) {
  val = JSON.stringify(val);

  // escape illegal js but valid json unicode characters
  val = val.replace(/[\u000A\u000D\u2028\u2029]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });

  if (this.format.quotes === "single") {
    // remove double quotes
    val = val.slice(1, -1);

    // unescape double quotes
    val = val.replace(/\\"/g, '"');

    // escape single quotes
    val = val.replace(/'/g, "\\'");

    // add single quotes
    val = "'" + val + "'";
  }

  return val;
}