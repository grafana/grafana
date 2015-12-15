/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _debugNode = require("debug/node");

var _debugNode2 = _interopRequireDefault(_debugNode);

var verboseDebug = _debugNode2["default"]("babel:verbose");
var generalDebug = _debugNode2["default"]("babel");

var seenDeprecatedMessages = [];

/**
 * [Please add a description.]
 */

var Logger = (function () {
  function Logger(file, filename) {
    _classCallCheck(this, Logger);

    this.filename = filename;
    this.file = file;
  }

  /**
   * [Please add a description.]
   */

  Logger.prototype._buildMessage = function _buildMessage(msg) {
    var parts = "[BABEL] " + this.filename;
    if (msg) parts += ": " + msg;
    return parts;
  };

  /**
   * [Please add a description.]
   */

  Logger.prototype.warn = function warn(msg) {
    console.warn(this._buildMessage(msg));
  };

  /**
   * [Please add a description.]
   */

  Logger.prototype.error = function error(msg) {
    var Constructor = arguments.length <= 1 || arguments[1] === undefined ? Error : arguments[1];

    throw new Constructor(this._buildMessage(msg));
  };

  /**
   * [Please add a description.]
   */

  Logger.prototype.deprecate = function deprecate(msg) {
    if (this.file.opts && this.file.opts.suppressDeprecationMessages) return;

    msg = this._buildMessage(msg);

    // already seen this message
    if (seenDeprecatedMessages.indexOf(msg) >= 0) return;

    // make sure we don't see it again
    seenDeprecatedMessages.push(msg);

    console.error(msg);
  };

  /**
   * [Please add a description.]
   */

  Logger.prototype.verbose = function verbose(msg) {
    if (verboseDebug.enabled) verboseDebug(this._buildMessage(msg));
  };

  /**
   * [Please add a description.]
   */

  Logger.prototype.debug = function debug(msg) {
    if (generalDebug.enabled) generalDebug(this._buildMessage(msg));
  };

  /**
   * [Please add a description.]
   */

  Logger.prototype.deopt = function deopt(node, msg) {
    this.debug(msg);
  };

  return Logger;
})();

exports["default"] = Logger;
module.exports = exports["default"];