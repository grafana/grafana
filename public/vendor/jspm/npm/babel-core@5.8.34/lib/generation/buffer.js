/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _repeating = require("repeating");

var _repeating2 = _interopRequireDefault(_repeating);

var _trimRight = require("trim-right");

var _trimRight2 = _interopRequireDefault(_trimRight);

var _lodashLangIsBoolean = require("lodash/lang/isBoolean");

var _lodashLangIsBoolean2 = _interopRequireDefault(_lodashLangIsBoolean);

var _lodashCollectionIncludes = require("lodash/collection/includes");

var _lodashCollectionIncludes2 = _interopRequireDefault(_lodashCollectionIncludes);

var _lodashLangIsNumber = require("lodash/lang/isNumber");

var _lodashLangIsNumber2 = _interopRequireDefault(_lodashLangIsNumber);

/**
 * Buffer for collecting generated output.
 */

var Buffer = (function () {
  function Buffer(position, format) {
    _classCallCheck(this, Buffer);

    this.parenPushNewlineState = null;

    this.position = position;
    this._indent = format.indent.base;
    this.format = format;
    this.buf = "";
  }

  /**
   * Get the current trimmed buffer.
   */

  Buffer.prototype.get = function get() {
    return _trimRight2["default"](this.buf);
  };

  /**
   * Get the current indent.
   */

  Buffer.prototype.getIndent = function getIndent() {
    if (this.format.compact || this.format.concise) {
      return "";
    } else {
      return _repeating2["default"](this.format.indent.style, this._indent);
    }
  };

  /**
   * Get the current indent size.
   */

  Buffer.prototype.indentSize = function indentSize() {
    return this.getIndent().length;
  };

  /**
   * Increment indent size.
   */

  Buffer.prototype.indent = function indent() {
    this._indent++;
  };

  /**
   * Decrement indent size.
   */

  Buffer.prototype.dedent = function dedent() {
    this._indent--;
  };

  /**
   * Add a semicolon to the buffer.
   */

  Buffer.prototype.semicolon = function semicolon() {
    this.push(";");
  };

  /**
   * Ensure last character is a semicolon.
   */

  Buffer.prototype.ensureSemicolon = function ensureSemicolon() {
    if (!this.isLast(";")) this.semicolon();
  };

  /**
   * Add a right brace to the buffer.
   */

  Buffer.prototype.rightBrace = function rightBrace() {
    this.newline(true);
    //if (this.format.compact) this._removeLast(";");
    this.push("}");
  };

  /**
   * Add a keyword to the buffer.
   */

  Buffer.prototype.keyword = function keyword(name) {
    this.push(name);
    this.space();
  };

  /**
   * Add a space to the buffer unless it is compact (override with force).
   */

  Buffer.prototype.space = function space(force) {
    if (!force && this.format.compact) return;

    if (force || this.buf && !this.isLast(" ") && !this.isLast("\n")) {
      this.push(" ");
    }
  };

  /**
   * Remove the last character.
   */

  Buffer.prototype.removeLast = function removeLast(cha) {
    if (this.format.compact) return;
    return this._removeLast(cha);
  };

  Buffer.prototype._removeLast = function _removeLast(cha) {
    if (!this._isLast(cha)) return;
    this.buf = this.buf.substr(0, this.buf.length - 1);
    this.position.unshift(cha);
  };

  /**
   * Set some state that will be modified if a newline has been inserted before any
   * non-space characters.
   *
   * This is to prevent breaking semantics for terminatorless separator nodes. eg:
   *
   *    return foo;
   *
   * returns `foo`. But if we do:
   *
   *   return
   *   foo;
   *
   *  `undefined` will be returned and not `foo` due to the terminator.
   */

  Buffer.prototype.startTerminatorless = function startTerminatorless() {
    return this.parenPushNewlineState = {
      printed: false
    };
  };

  /**
   * Print an ending parentheses if a starting one has been printed.
   */

  Buffer.prototype.endTerminatorless = function endTerminatorless(state) {
    if (state.printed) {
      this.dedent();
      this.newline();
      this.push(")");
    }
  };

  /**
   * Add a newline (or many newlines), maintaining formatting.
   * Strips multiple newlines if removeLast is true.
   */

  Buffer.prototype.newline = function newline(i, removeLast) {
    if (this.format.compact || this.format.retainLines) return;

    if (this.format.concise) {
      this.space();
      return;
    }

    removeLast = removeLast || false;

    if (_lodashLangIsNumber2["default"](i)) {
      i = Math.min(2, i);

      if (this.endsWith("{\n") || this.endsWith(":\n")) i--;
      if (i <= 0) return;

      while (i > 0) {
        this._newline(removeLast);
        i--;
      }
      return;
    }

    if (_lodashLangIsBoolean2["default"](i)) {
      removeLast = i;
    }

    this._newline(removeLast);
  };

  /**
   * Adds a newline unless there is already two previous newlines.
   */

  Buffer.prototype._newline = function _newline(removeLast) {
    // never allow more than two lines
    if (this.endsWith("\n\n")) return;

    // remove the last newline
    if (removeLast && this.isLast("\n")) this.removeLast("\n");

    this.removeLast(" ");
    this._removeSpacesAfterLastNewline();
    this._push("\n");
  };

  /**
   * If buffer ends with a newline and some spaces after it, trim those spaces.
   */

  Buffer.prototype._removeSpacesAfterLastNewline = function _removeSpacesAfterLastNewline() {
    var lastNewlineIndex = this.buf.lastIndexOf("\n");
    if (lastNewlineIndex === -1) {
      return;
    }

    var index = this.buf.length - 1;
    while (index > lastNewlineIndex) {
      if (this.buf[index] !== " ") {
        break;
      }

      index--;
    }

    if (index === lastNewlineIndex) {
      this.buf = this.buf.substring(0, index + 1);
    }
  };

  /**
   * Push a string to the buffer, maintaining indentation and newlines.
   */

  Buffer.prototype.push = function push(str, noIndent) {
    if (!this.format.compact && this._indent && !noIndent && str !== "\n") {
      // we have an indent level and we aren't pushing a newline
      var indent = this.getIndent();

      // replace all newlines with newlines with the indentation
      str = str.replace(/\n/g, "\n" + indent);

      // we've got a newline before us so prepend on the indentation
      if (this.isLast("\n")) this._push(indent);
    }

    this._push(str);
  };

  /**
   * Push a string to the buffer.
   */

  Buffer.prototype._push = function _push(str) {
    // see startTerminatorless() instance method
    var parenPushNewlineState = this.parenPushNewlineState;
    if (parenPushNewlineState) {
      for (var i = 0; i < str.length; i++) {
        var cha = str[i];

        // we can ignore spaces since they wont interupt a terminatorless separator
        if (cha === " ") continue;

        this.parenPushNewlineState = null;

        if (cha === "\n" || cha === "/") {
          // we're going to break this terminator expression so we need to add a parentheses
          this._push("(");
          this.indent();
          parenPushNewlineState.printed = true;
        }

        break;
      }
    }

    //
    this.position.push(str);
    this.buf += str;
  };

  /**
   * Test if the buffer ends with a string.
   */

  Buffer.prototype.endsWith = function endsWith(str) {
    var buf = arguments.length <= 1 || arguments[1] === undefined ? this.buf : arguments[1];

    if (str.length === 1) {
      return buf[buf.length - 1] === str;
    } else {
      return buf.slice(-str.length) === str;
    }
  };

  /**
   * Test if a character is last in the buffer.
   */

  Buffer.prototype.isLast = function isLast(cha) {
    if (this.format.compact) return false;
    return this._isLast(cha);
  };

  Buffer.prototype._isLast = function _isLast(cha) {
    var buf = this.buf;
    var last = buf[buf.length - 1];

    if (Array.isArray(cha)) {
      return _lodashCollectionIncludes2["default"](cha, last);
    } else {
      return cha === last;
    }
  };

  return Buffer;
})();

exports["default"] = Buffer;
module.exports = exports["default"];