/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.internal = internal;
exports.blacklist = blacklist;
exports.whitelist = whitelist;
exports.stage = stage;
exports.optional = optional;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashCollectionIncludes = require("lodash/collection/includes");

var _lodashCollectionIncludes2 = _interopRequireDefault(_lodashCollectionIncludes);

/**
 * [Please add a description.]
 */

function internal(transformer) {
  if (transformer.key[0] === "_") return true;
}

/**
 * [Please add a description.]
 */

function blacklist(transformer, opts) {
  var blacklist = opts.blacklist;
  if (blacklist.length && _lodashCollectionIncludes2["default"](blacklist, transformer.key)) return false;
}

/**
 * [Please add a description.]
 */

function whitelist(transformer, opts) {
  var whitelist = opts.whitelist;
  if (whitelist) return _lodashCollectionIncludes2["default"](whitelist, transformer.key);
}

/**
 * [Please add a description.]
 */

function stage(transformer, opts) {
  var stage = transformer.metadata.stage;
  if (stage != null && stage >= opts.stage) return true;
}

/**
 * [Please add a description.]
 */

function optional(transformer, opts) {
  if (transformer.metadata.optional && !_lodashCollectionIncludes2["default"](opts.optional, transformer.key)) return false;
}