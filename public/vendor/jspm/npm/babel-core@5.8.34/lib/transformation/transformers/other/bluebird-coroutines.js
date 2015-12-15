/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.manipulateOptions = manipulateOptions;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _helpersRemapAsyncToGenerator = require("../../helpers/remap-async-to-generator");

var _helpersRemapAsyncToGenerator2 = _interopRequireDefault(_helpersRemapAsyncToGenerator);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function manipulateOptions(opts) {
  opts.blacklist.push("regenerator");
}

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

    return _helpersRemapAsyncToGenerator2["default"](this, t.memberExpression(file.addImport("bluebird", null, "absolute"), t.identifier("coroutine")));
  }
};
exports.visitor = visitor;