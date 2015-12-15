/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.transformerList = transformerList;
exports.number = number;
exports.boolean = boolean;
exports.booleanString = booleanString;
exports.list = list;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _slash = require("slash");

var _slash2 = _interopRequireDefault(_slash);

var _util = require("../../../util");

var util = _interopRequireWildcard(_util);

/**
 * Get a transformer list from a value.
 */

function transformerList(val) {
  return util.arrayify(val);
}

/**
 * Validate transformer list. Maps "all" to all transformer names.
 */

transformerList.validate = function (key, val, pipeline) {
  if (val.indexOf("all") >= 0 || val.indexOf(true) >= 0) {
    val = Object.keys(pipeline.transformers);
  }

  return pipeline._ensureTransformerNames(key, val);
};

/**
 * Cast a value to a number.
 */

function number(val) {
  return +val;
}

/**
 * Cast a value to a boolean.
 */

var filename = _slash2["default"];

exports.filename = filename;
/**
 * [Please add a description.]
 */

function boolean(val) {
  return !!val;
}

/**
 * Cast a boolean-like string to a boolean.
 */

function booleanString(val) {
  return util.booleanify(val);
}

/**
 * Cast a value to an array, splitting strings by ",".
 */

function list(val) {
  return util.list(val);
}