/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports["default"] = defineType;
var VISITOR_KEYS = {};
exports.VISITOR_KEYS = VISITOR_KEYS;
var ALIAS_KEYS = {};
exports.ALIAS_KEYS = ALIAS_KEYS;
var BUILDER_KEYS = {};

exports.BUILDER_KEYS = BUILDER_KEYS;
function builderFromArray(arr) {
  var builder = {};
  var _arr = arr;
  for (var _i = 0; _i < _arr.length; _i++) {
    var key = _arr[_i];builder[key] = null;
  }return builder;
}

function defineType(type) {
  var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  opts.visitor = opts.visitor || [];
  opts.aliases = opts.aliases || [];

  if (!opts.builder) opts.builder = builderFromArray(opts.visitor);
  if (Array.isArray(opts.builder)) opts.builder = builderFromArray(opts.builder);

  VISITOR_KEYS[type] = opts.visitor;
  ALIAS_KEYS[type] = opts.aliases;
  BUILDER_KEYS[type] = opts.builder;
}