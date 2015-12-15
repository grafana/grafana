/* */ 
"format cjs";
/**
 * Printer for nodes, needs a `generator` and a `parent`.
 */

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NodePrinter = (function () {
  function NodePrinter(generator, parent) {
    _classCallCheck(this, NodePrinter);

    this.generator = generator;
    this.parent = parent;
  }

  /**
   * Description
   */

  NodePrinter.prototype.printInnerComments = function printInnerComments() {
    if (!this.parent.innerComments) return;
    var gen = this.generator;
    gen.indent();
    gen._printComments(this.parent.innerComments);
    gen.dedent();
  };

  /**
   * Print a plain node.
   */

  NodePrinter.prototype.plain = function plain(node, opts) {
    return this.generator.print(node, this.parent, opts);
  };

  /**
   * Print a sequence of nodes as statements.
   */

  NodePrinter.prototype.sequence = function sequence(nodes) {
    var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    opts.statement = true;
    return this.generator.printJoin(this, nodes, opts);
  };

  /**
   * Print a sequence of nodes as expressions.
   */

  NodePrinter.prototype.join = function join(nodes, opts) {
    return this.generator.printJoin(this, nodes, opts);
  };

  /**
   * Print a list of nodes, with a customizable separator (defaults to ",").
   */

  NodePrinter.prototype.list = function list(items) {
    var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    if (opts.separator == null) {
      opts.separator = ",";
      if (!this.generator.format.compact) opts.separator += " ";
    }

    return this.join(items, opts);
  };

  /**
   * Print a block-like node.
   */

  NodePrinter.prototype.block = function block(node) {
    return this.generator.printBlock(this, node);
  };

  /**
   * Print node and indent comments.
   */

  NodePrinter.prototype.indentOnComments = function indentOnComments(node) {
    return this.generator.printAndIndentOnComments(this, node);
  };

  return NodePrinter;
})();

exports["default"] = NodePrinter;
module.exports = exports["default"];