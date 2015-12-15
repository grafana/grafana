/* */ 
"format cjs";
/**
 * Prints TaggedTemplateExpression, prints tag and quasi.
 */

"use strict";

exports.__esModule = true;
exports.TaggedTemplateExpression = TaggedTemplateExpression;
exports.TemplateElement = TemplateElement;
exports.TemplateLiteral = TemplateLiteral;

function TaggedTemplateExpression(node, print) {
  print.plain(node.tag);
  print.plain(node.quasi);
}

/**
 * Prints TemplateElement, prints value.
 */

function TemplateElement(node) {
  this._push(node.value.raw);
}

/**
 * Prints TemplateLiteral, prints quasis, and expressions.
 */

function TemplateLiteral(node, print) {
  this.push("`");

  var quasis = node.quasis;
  var len = quasis.length;

  for (var i = 0; i < len; i++) {
    print.plain(quasis[i]);

    if (i + 1 < len) {
      this.push("${ ");
      print.plain(node.expressions[i]);
      this.push(" }");
    }
  }

  this._push("`");
}