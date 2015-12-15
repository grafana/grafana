/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _filePluginManager = require("./file/plugin-manager");

var _filePluginManager2 = _interopRequireDefault(_filePluginManager);

var _helpersNormalizeAst = require("../helpers/normalize-ast");

var _helpersNormalizeAst2 = _interopRequireDefault(_helpersNormalizeAst);

var _plugin = require("./plugin");

var _plugin2 = _interopRequireDefault(_plugin);

var _lodashObjectAssign = require("lodash/object/assign");

var _lodashObjectAssign2 = _interopRequireDefault(_lodashObjectAssign);

var _helpersObject = require("../helpers/object");

var _helpersObject2 = _interopRequireDefault(_helpersObject);

var _file = require("./file");

var _file2 = _interopRequireDefault(_file);

/**
 * [Please add a description.]
 */

var Pipeline = (function () {
  function Pipeline() {
    _classCallCheck(this, Pipeline);

    this.transformers = _helpersObject2["default"]();
    this.namespaces = _helpersObject2["default"]();
    this.deprecated = _helpersObject2["default"]();
    this.aliases = _helpersObject2["default"]();
    this.filters = [];
  }

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.addTransformers = function addTransformers(transformers) {
    for (var key in transformers) {
      this.addTransformer(key, transformers[key]);
    }
    return this;
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.addTransformer = function addTransformer(key, plugin) {
    if (this.transformers[key]) throw new Error(); // todo: error

    var namespace = key.split(".")[0];
    this.namespaces[namespace] = this.namespaces[namespace] || [];
    this.namespaces[namespace].push(key);
    this.namespaces[key] = namespace;

    if (typeof plugin === "function") {
      plugin = _filePluginManager2["default"].memoisePluginContainer(plugin);
      plugin.key = key;
      plugin.metadata.optional = true;

      if (key === "react.displayName") {
        plugin.metadata.optional = false;
      }
    } else {
      plugin = new _plugin2["default"](key, plugin);
    }

    this.transformers[key] = plugin;
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.addAliases = function addAliases(names) {
    _lodashObjectAssign2["default"](this.aliases, names);
    return this;
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.addDeprecated = function addDeprecated(names) {
    _lodashObjectAssign2["default"](this.deprecated, names);
    return this;
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.addFilter = function addFilter(filter) {
    this.filters.push(filter);
    return this;
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.canTransform = function canTransform(plugin, fileOpts) {
    if (plugin.metadata.plugin) {
      return true;
    }

    var _arr = this.filters;
    for (var _i = 0; _i < _arr.length; _i++) {
      var filter = _arr[_i];
      var result = filter(plugin, fileOpts);
      if (result != null) return result;
    }

    return true;
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.analyze = function analyze(code) {
    var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    opts.code = false;
    return this.transform(code, opts);
  };

  /**
   * Build dependency graph by recursing `metadata.modules`. WIP.
   */

  Pipeline.prototype.pretransform = function pretransform(code, opts) {
    var file = new _file2["default"](opts, this);
    return file.wrap(code, function () {
      file.addCode(code);
      file.parseCode(code);
      return file;
    });
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.transform = function transform(code, opts) {
    var file = new _file2["default"](opts, this);
    return file.wrap(code, function () {
      file.addCode(code);
      file.parseCode(code);
      return file.transform();
    });
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype.transformFromAst = function transformFromAst(ast, code, opts) {
    ast = _helpersNormalizeAst2["default"](ast);

    var file = new _file2["default"](opts, this);
    return file.wrap(code, function () {
      file.addCode(code);
      file.addAst(ast);
      return file.transform();
    });
  };

  /**
   * [Please add a description.]
   */

  Pipeline.prototype._ensureTransformerNames = function _ensureTransformerNames(type, rawKeys) {
    var keys = [];

    for (var i = 0; i < rawKeys.length; i++) {
      var key = rawKeys[i];
      var deprecatedKey = this.deprecated[key];
      var aliasKey = this.aliases[key];
      if (aliasKey) {
        keys.push(aliasKey);
      } else if (deprecatedKey) {
        // deprecated key, remap it to the new one
        console.error("[BABEL] The transformer " + key + " has been renamed to " + deprecatedKey);
        rawKeys.push(deprecatedKey);
      } else if (this.transformers[key]) {
        // valid key
        keys.push(key);
      } else if (this.namespaces[key]) {
        // namespace, append all transformers within this namespace
        keys = keys.concat(this.namespaces[key]);
      } else {
        // invalid key
        throw new ReferenceError("Unknown transformer " + key + " specified in " + type);
      }
    }

    return keys;
  };

  return Pipeline;
})();

exports["default"] = Pipeline;
module.exports = exports["default"];