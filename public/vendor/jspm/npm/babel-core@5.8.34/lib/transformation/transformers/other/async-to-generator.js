/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _helpersRemapAsyncToGenerator = require("../../helpers/remap-async-to-generator");

var _helpersRemapAsyncToGenerator2 = _interopRequireDefault(_helpersRemapAsyncToGenerator);

var _bluebirdCoroutines = require("./bluebird-coroutines");

exports.manipulateOptions = _bluebirdCoroutines.manipulateOptions;
var metadata = {
  optional: true,
  dependencies: ["es7.asyncFunctions", "es6.classes"]
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Function: function Function(node, parent, scope, file) {
    if (!node.async || node.generator) return;

    return _helpersRemapAsyncToGenerator2["default"](this, file.addHelper("async-to-generator"));
  }
};
exports.visitor = visitor;