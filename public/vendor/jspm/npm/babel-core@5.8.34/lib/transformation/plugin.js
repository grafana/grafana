/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _pluginPass = require("./plugin-pass");

var _pluginPass2 = _interopRequireDefault(_pluginPass);

var _messages = require("../messages");

var messages = _interopRequireWildcard(_messages);

var _traversal = require("../traversal");

var _traversal2 = _interopRequireDefault(_traversal);

var _lodashObjectAssign = require("lodash/object/assign");

var _lodashObjectAssign2 = _interopRequireDefault(_lodashObjectAssign);

var _lodashLangClone = require("lodash/lang/clone");

var _lodashLangClone2 = _interopRequireDefault(_lodashLangClone);

var _file = require("./file");

var _file2 = _interopRequireDefault(_file);

var _types = require("../types");

var t = _interopRequireWildcard(_types);

var VALID_PLUGIN_PROPERTIES = ["visitor", "metadata", "manipulateOptions", "post", "pre"];

var VALID_METADATA_PROPERTIES = ["dependencies", "optional", "stage", "group", "experimental", "secondPass"];

/**
 * [Please add a description.]
 */

var Plugin = (function () {
  function Plugin(key, plugin) {
    _classCallCheck(this, Plugin);

    Plugin.validate(key, plugin);

    plugin = _lodashObjectAssign2["default"]({}, plugin);

    var take = function take(key) {
      var val = plugin[key];
      delete plugin[key];
      return val;
    };

    this.manipulateOptions = take("manipulateOptions");
    this.metadata = take("metadata") || {};
    this.dependencies = this.metadata.dependencies || [];
    this.post = take("post");
    this.pre = take("pre");

    //

    if (this.metadata.stage != null) {
      this.metadata.optional = true;
    }

    //

    this.visitor = this.normalize(_lodashLangClone2["default"](take("visitor")) || {});
    this.key = key;
  }

  /**
   * [Please add a description.]
   */

  Plugin.validate = function validate(name, plugin) {
    for (var key in plugin) {
      if (key[0] === "_") continue;
      if (VALID_PLUGIN_PROPERTIES.indexOf(key) >= 0) continue;

      var msgType = "pluginInvalidProperty";
      if (t.TYPES.indexOf(key) >= 0) msgType = "pluginInvalidPropertyVisitor";
      throw new Error(messages.get(msgType, name, key));
    }

    for (var key in plugin.metadata) {
      if (VALID_METADATA_PROPERTIES.indexOf(key) >= 0) continue;

      throw new Error(messages.get("pluginInvalidProperty", name, "metadata." + key));
    }
  };

  /**
   * [Please add a description.]
   */

  Plugin.prototype.normalize = function normalize(visitor) {
    _traversal2["default"].explode(visitor);
    return visitor;
  };

  /**
   * [Please add a description.]
   */

  Plugin.prototype.buildPass = function buildPass(file) {
    // validate Transformer instance
    if (!(file instanceof _file2["default"])) {
      throw new TypeError(messages.get("pluginNotFile", this.key));
    }

    return new _pluginPass2["default"](file, this);
  };

  return Plugin;
})();

exports["default"] = Plugin;
module.exports = exports["default"];