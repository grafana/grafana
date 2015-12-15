/* */ 
"format cjs";
/**
 * [Please add a description.]
 */

"use strict";

exports.__esModule = true;
var visitor = {

  /**
   * [Please add a description.]
   */

  Property: function Property(node) {
    if (node.method) {
      node.method = false;
    }

    if (node.shorthand) {
      node.shorthand = false;
    }
  }
};
exports.visitor = visitor;