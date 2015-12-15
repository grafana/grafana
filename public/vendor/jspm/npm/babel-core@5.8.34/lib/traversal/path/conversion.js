/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.toComputedKey = toComputedKey;
exports.ensureBlock = ensureBlock;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function toComputedKey() {
  var node = this.node;

  var key;
  if (this.isMemberExpression()) {
    key = node.property;
  } else if (this.isProperty()) {
    key = node.key;
  } else {
    throw new ReferenceError("todo");
  }

  if (!node.computed) {
    if (t.isIdentifier(key)) key = t.literal(key.name);
  }

  return key;
}

/**
 * [Please add a description.]
 */

function ensureBlock() {
  return t.ensureBlock(this.node);
}