/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.is = is;
exports.pullFlag = pullFlag;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashArrayPull = require("lodash/array/pull");

var _lodashArrayPull2 = _interopRequireDefault(_lodashArrayPull);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function is(node, flag) {
  return t.isLiteral(node) && node.regex && node.regex.flags.indexOf(flag) >= 0;
}

/**
 * [Please add a description.]
 */

function pullFlag(node, flag) {
  var flags = node.regex.flags.split("");
  if (node.regex.flags.indexOf(flag) < 0) return;
  _lodashArrayPull2["default"](flags, flag);
  node.regex.flags = flags.join("");
}