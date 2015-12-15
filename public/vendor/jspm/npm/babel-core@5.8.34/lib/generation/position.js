/* */ 
"format cjs";
/**
 * Track current position in code generation.
 */

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Position = (function () {
  function Position() {
    _classCallCheck(this, Position);

    this.line = 1;
    this.column = 0;
  }

  /**
   * Push a string to the current position, mantaining the current line and column.
   */

  Position.prototype.push = function push(str) {
    for (var i = 0; i < str.length; i++) {
      if (str[i] === "\n") {
        this.line++;
        this.column = 0;
      } else {
        this.column++;
      }
    }
  };

  /**
   * Unshift a string from the current position, mantaining the current line and column.
   */

  Position.prototype.unshift = function unshift(str) {
    for (var i = 0; i < str.length; i++) {
      if (str[i] === "\n") {
        this.line--;
      } else {
        this.column--;
      }
    }
  };

  return Position;
})();

exports["default"] = Position;
module.exports = exports["default"];