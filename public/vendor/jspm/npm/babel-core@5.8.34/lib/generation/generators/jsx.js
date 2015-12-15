/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.JSXAttribute = JSXAttribute;
exports.JSXIdentifier = JSXIdentifier;
exports.JSXNamespacedName = JSXNamespacedName;
exports.JSXMemberExpression = JSXMemberExpression;
exports.JSXSpreadAttribute = JSXSpreadAttribute;
exports.JSXExpressionContainer = JSXExpressionContainer;
exports.JSXElement = JSXElement;
exports.JSXOpeningElement = JSXOpeningElement;
exports.JSXClosingElement = JSXClosingElement;
exports.JSXEmptyExpression = JSXEmptyExpression;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Prints JSXAttribute, prints name and value.
 */

function JSXAttribute(node, print) {
  print.plain(node.name);
  if (node.value) {
    this.push("=");
    print.plain(node.value);
  }
}

/**
 * Prints JSXIdentifier, prints name.
 */

function JSXIdentifier(node) {
  this.push(node.name);
}

/**
 * Prints JSXNamespacedName, prints namespace and name.
 */

function JSXNamespacedName(node, print) {
  print.plain(node.namespace);
  this.push(":");
  print.plain(node.name);
}

/**
 * Prints JSXMemberExpression, prints object and property.
 */

function JSXMemberExpression(node, print) {
  print.plain(node.object);
  this.push(".");
  print.plain(node.property);
}

/**
 * Prints JSXSpreadAttribute, prints argument.
 */

function JSXSpreadAttribute(node, print) {
  this.push("{...");
  print.plain(node.argument);
  this.push("}");
}

/**
 * Prints JSXExpressionContainer, prints expression.
 */

function JSXExpressionContainer(node, print) {
  this.push("{");
  print.plain(node.expression);
  this.push("}");
}

/**
 * Prints JSXElement, prints openingElement, children, and closingElement.
 */

function JSXElement(node, print) {
  var open = node.openingElement;
  print.plain(open);
  if (open.selfClosing) return;

  this.indent();
  var _arr = node.children;
  for (var _i = 0; _i < _arr.length; _i++) {
    var child = _arr[_i];
    if (t.isLiteral(child)) {
      this.push(child.value, true);
    } else {
      print.plain(child);
    }
  }
  this.dedent();

  print.plain(node.closingElement);
}

/**
 * Prints JSXOpeningElement, prints name and attributes, handles selfClosing.
 */

function JSXOpeningElement(node, print) {
  this.push("<");
  print.plain(node.name);
  if (node.attributes.length > 0) {
    this.push(" ");
    print.join(node.attributes, { separator: " " });
  }
  this.push(node.selfClosing ? " />" : ">");
}

/**
 * Prints JSXClosingElement, prints name.
 */

function JSXClosingElement(node, print) {
  this.push("</");
  print.plain(node.name);
  this.push(">");
}

/**
 * Prints JSXEmptyExpression.
 */

function JSXEmptyExpression() {}