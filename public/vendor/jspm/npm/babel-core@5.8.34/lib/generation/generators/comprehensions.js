/* */ 
"format cjs";
/**
 * Prints ComprehensionBlock, prints left and right.
 */

"use strict";

exports.__esModule = true;
exports.ComprehensionBlock = ComprehensionBlock;
exports.ComprehensionExpression = ComprehensionExpression;

function ComprehensionBlock(node, print) {
  this.keyword("for");
  this.push("(");
  print.plain(node.left);
  this.push(" of ");
  print.plain(node.right);
  this.push(")");
}

/**
 * Prints ComprehensionExpression, prints blocks, filter, and body. Handles generators.
 */

function ComprehensionExpression(node, print) {
  this.push(node.generator ? "(" : "[");

  print.join(node.blocks, { separator: " " });
  this.space();

  if (node.filter) {
    this.keyword("if");
    this.push("(");
    print.plain(node.filter);
    this.push(")");
    this.space();
  }

  print.plain(node.body);

  this.push(node.generator ? ")" : "]");
}