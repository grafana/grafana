/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _plugin = require("./plugin");

var _plugin2 = _interopRequireDefault(_plugin);

/**
 * [Please add a description.]
 */

var Transformer = function Transformer(key, obj) {
  _classCallCheck(this, Transformer);

  var plugin = {};

  plugin.metadata = obj.metadata;
  delete obj.metadata;

  plugin.visitor = obj;

  return new _plugin2["default"](key, plugin);
};

exports["default"] = Transformer;
module.exports = exports["default"];