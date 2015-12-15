/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _index = require("./index");

var _json5 = require("json5");

var _json52 = _interopRequireDefault(_json5);

var _pathIsAbsolute = require("path-is-absolute");

var _pathIsAbsolute2 = _interopRequireDefault(_pathIsAbsolute);

var _pathExists = require("path-exists");

var _pathExists2 = _interopRequireDefault(_pathExists);

var _lodashLangClone = require("lodash/lang/clone");

var _lodashLangClone2 = _interopRequireDefault(_lodashLangClone);

var _helpersMerge = require("../../../helpers/merge");

var _helpersMerge2 = _interopRequireDefault(_helpersMerge);

var _config = require("./config");

var _config2 = _interopRequireDefault(_config);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var existsCache = {};
var jsonCache = {};

var BABELIGNORE_FILENAME = ".babelignore";
var BABELRC_FILENAME = ".babelrc";
var PACKAGE_FILENAME = "package.json";

function exists(filename) {
  var cached = existsCache[filename];
  if (cached != null) {
    return cached;
  } else {
    return existsCache[filename] = _pathExists2["default"].sync(filename);
  }
}

var OptionManager = (function () {
  function OptionManager(log, pipeline) {
    _classCallCheck(this, OptionManager);

    this.resolvedConfigs = [];
    this.options = OptionManager.createBareOptions();
    this.pipeline = pipeline;
    this.log = log;
  }

  /**
   * [Please add a description.]
   */

  OptionManager.createBareOptions = function createBareOptions() {
    var opts = {};

    for (var key in _config2["default"]) {
      var opt = _config2["default"][key];
      opts[key] = _lodashLangClone2["default"](opt["default"]);
    }

    return opts;
  };

  /**
   * [Please add a description.]
   */

  OptionManager.prototype.addConfig = function addConfig(loc, key) {
    var json = arguments.length <= 2 || arguments[2] === undefined ? _json52["default"] : arguments[2];

    if (this.resolvedConfigs.indexOf(loc) >= 0) return;

    var content = _fs2["default"].readFileSync(loc, "utf8");
    var opts;

    try {
      opts = jsonCache[content] = jsonCache[content] || json.parse(content);
      if (key) opts = opts[key];
    } catch (err) {
      err.message = loc + ": Error while parsing JSON - " + err.message;
      throw err;
    }

    this.mergeOptions(opts, loc);
    this.resolvedConfigs.push(loc);
  };

  /**
   * [Please add a description.]
   */

  OptionManager.prototype.mergeOptions = function mergeOptions(opts) {
    var alias = arguments.length <= 1 || arguments[1] === undefined ? "foreign" : arguments[1];

    if (!opts) return;

    for (var key in opts) {
      if (key[0] === "_") continue;

      var option = _config2["default"][key];

      // check for an unknown option
      if (!option) this.log.error("Unknown option: " + alias + "." + key, ReferenceError);
    }

    // normalise options
    _index.normaliseOptions(opts);

    // merge them into this current files options
    _helpersMerge2["default"](this.options, opts);
  };

  /**
   * [Please add a description.]
   */

  OptionManager.prototype.addIgnoreConfig = function addIgnoreConfig(loc) {
    var file = _fs2["default"].readFileSync(loc, "utf8");
    var lines = file.split("\n");

    lines = lines.map(function (line) {
      return line.replace(/#(.*?)$/, "").trim();
    }).filter(function (line) {
      return !!line;
    });

    this.mergeOptions({ ignore: lines }, loc);
  };

  /**
   * Description
   */

  OptionManager.prototype.findConfigs = function findConfigs(loc) {
    if (!loc) return;

    if (!_pathIsAbsolute2["default"](loc)) {
      loc = _path2["default"].join(process.cwd(), loc);
    }

    while (loc !== (loc = _path2["default"].dirname(loc))) {
      if (this.options.breakConfig) return;

      var configLoc = _path2["default"].join(loc, BABELRC_FILENAME);
      if (exists(configLoc)) this.addConfig(configLoc);

      var pkgLoc = _path2["default"].join(loc, PACKAGE_FILENAME);
      if (exists(pkgLoc)) this.addConfig(pkgLoc, "babel", JSON);

      var ignoreLoc = _path2["default"].join(loc, BABELIGNORE_FILENAME);
      if (exists(ignoreLoc)) this.addIgnoreConfig(ignoreLoc);
    }
  };

  /**
   * [Please add a description.]
   */

  OptionManager.prototype.normaliseOptions = function normaliseOptions() {
    var opts = this.options;

    for (var key in _config2["default"]) {
      var option = _config2["default"][key];
      var val = opts[key];

      // optional
      if (!val && option.optional) continue;

      // deprecated
      if (this.log && val && option.deprecated) {
        this.log.deprecate("Deprecated option " + key + ": " + option.deprecated);
      }

      // validate
      if (this.pipeline && val) {
        val = _index.validateOption(key, val, this.pipeline);
      }

      // aaliases
      if (option.alias) {
        opts[option.alias] = opts[option.alias] || val;
      } else {
        opts[key] = val;
      }
    }
  };

  /**
   * [Please add a description.]
   */

  OptionManager.prototype.init = function init(opts) {
    this.mergeOptions(opts, "direct");

    // babelrc option
    if (opts.babelrc) {
      var _arr = opts.babelrc;

      for (var _i = 0; _i < _arr.length; _i++) {
        var loc = _arr[_i];this.addConfig(loc);
      }
    }

    // resolve all .babelrc files
    if (opts.babelrc !== false) {
      this.findConfigs(opts.filename);
    }

    // merge in env
    var envKey = process.env.BABEL_ENV || process.env.NODE_ENV || "development";
    if (this.options.env) {
      this.mergeOptions(this.options.env[envKey], "direct.env." + envKey);
    }

    // normalise
    this.normaliseOptions(opts);

    return this.options;
  };

  return OptionManager;
})();

exports["default"] = OptionManager;
module.exports = exports["default"];