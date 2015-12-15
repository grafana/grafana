/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lineNumbers = require("line-numbers");

var _lineNumbers2 = _interopRequireDefault(_lineNumbers);

var _repeating = require("repeating");

var _repeating2 = _interopRequireDefault(_repeating);

var _jsTokens = require("js-tokens");

var _jsTokens2 = _interopRequireDefault(_jsTokens);

var _esutils = require("esutils");

var _esutils2 = _interopRequireDefault(_esutils);

var _chalk = require("chalk");

var _chalk2 = _interopRequireDefault(_chalk);

/**
 * Chalk styles for token types.
 */

var defs = {
  string: _chalk2["default"].red,
  punctuator: _chalk2["default"].bold,
  curly: _chalk2["default"].green,
  parens: _chalk2["default"].blue.bold,
  square: _chalk2["default"].yellow,
  keyword: _chalk2["default"].cyan,
  number: _chalk2["default"].magenta,
  regex: _chalk2["default"].magenta,
  comment: _chalk2["default"].grey,
  invalid: _chalk2["default"].inverse
};

/**
 * RegExp to test for newlines in terminal.
 */

var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;

/**
 * Get the type of token, specifying punctuator type.
 */

function getTokenType(match) {
  var token = _jsTokens2["default"].matchToToken(match);
  if (token.type === "name" && _esutils2["default"].keyword.isReservedWordES6(token.value)) {
    return "keyword";
  }

  if (token.type === "punctuator") {
    switch (token.value) {
      case "{":
      case "}":
        return "curly";
      case "(":
      case ")":
        return "parens";
      case "[":
      case "]":
        return "square";
    }
  }

  return token.type;
}

/**
 * Highlight `text`.
 */

function highlight(text) {
  return text.replace(_jsTokens2["default"], function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var type = getTokenType(args);
    var colorize = defs[type];
    if (colorize) {
      return args[0].split(NEWLINE).map(function (str) {
        return colorize(str);
      }).join("\n");
    } else {
      return args[0];
    }
  });
}

/**
 * Create a code frame, adding line numbers, code highlighting, and pointing to a given position.
 */

exports["default"] = function (lines, lineNumber, colNumber) {
  var opts = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

  colNumber = Math.max(colNumber, 0);

  var highlighted = opts.highlightCode && _chalk2["default"].supportsColor;
  if (highlighted) lines = highlight(lines);

  lines = lines.split(NEWLINE);

  var start = Math.max(lineNumber - 3, 0);
  var end = Math.min(lines.length, lineNumber + 3);

  if (!lineNumber && !colNumber) {
    start = 0;
    end = lines.length;
  }

  var frame = _lineNumbers2["default"](lines.slice(start, end), {
    start: start + 1,
    before: "  ",
    after: " | ",
    transform: function transform(params) {
      if (params.number !== lineNumber) {
        return;
      }

      if (colNumber) {
        params.line += "\n" + params.before + _repeating2["default"](" ", params.width) + params.after + _repeating2["default"](" ", colNumber - 1) + "^";
      }

      params.before = params.before.replace(/^./, ">");
    }
  }).join("\n");

  if (highlighted) {
    return _chalk2["default"].reset(frame);
  } else {
    return frame;
  }
};

module.exports = exports["default"];