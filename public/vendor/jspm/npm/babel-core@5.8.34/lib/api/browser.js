/* */ 
"format cjs";
/* eslint no-new-func: 0 */

"use strict";

require("./node");
var transform = module.exports = require("../transformation");

/**
 * Add `options` and `version` to `babel` global.
 */

transform.options = require("../transformation/file/options");
transform.version = require("../../package").version;

/**
 * Add `transform` api to `babel` global.
 */

transform.transform = transform;

/**
 * Tranform and execute script, adding in inline sourcemaps.
 */

transform.run = function (code) {
  var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  opts.sourceMaps = "inline";
  return new Function(transform(code, opts).code)();
};

/**
 * Load scripts via xhr, and `transform` when complete (optional).
 */

transform.load = function (url, callback, opts, hold) {
  if (opts === undefined) opts = {};

  opts.filename = opts.filename || url;

  var xhr = global.ActiveXObject ? new global.ActiveXObject("Microsoft.XMLHTTP") : new global.XMLHttpRequest();
  xhr.open("GET", url, true);
  if ("overrideMimeType" in xhr) xhr.overrideMimeType("text/plain");

  /**
   * When successfully loaded, transform (optional), and call `callback`.
   */

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;

    var status = xhr.status;
    if (status === 0 || status === 200) {
      var param = [xhr.responseText, opts];
      if (!hold) transform.run.apply(transform, param);
      if (callback) callback(param);
    } else {
      throw new Error("Could not load " + url);
    }
  };

  xhr.send(null);
};

/**
 * Load and transform all scripts of `types`.
 *
 * @example
 * <script type="module"></script>
 */

var runScripts = function runScripts() {
  var scripts = [];
  var types = ["text/ecmascript-6", "text/6to5", "text/babel", "module"];
  var index = 0;

  /**
   * Transform and execute script. Ensures correct load order.
   */

  var exec = function exec() {
    var param = scripts[index];
    if (param instanceof Array) {
      transform.run.apply(transform, param);
      index++;
      exec();
    }
  };

  /**
   * Load, transform, and execute all scripts.
   */

  var run = function run(script, i) {
    var opts = {};

    if (script.src) {
      transform.load(script.src, function (param) {
        scripts[i] = param;
        exec();
      }, opts, true);
    } else {
      opts.filename = "embedded";
      scripts[i] = [script.innerHTML, opts];
    }
  };

  // Collect scripts with Babel `types`.

  var _scripts = global.document.getElementsByTagName("script");

  for (var i = 0; i < _scripts.length; ++i) {
    var _script = _scripts[i];
    if (types.indexOf(_script.type) >= 0) scripts.push(_script);
  }

  for (i in scripts) {
    run(scripts[i], i);
  }

  exec();
};

/**
 * Register load event to transform and execute scripts.
 */

if (global.addEventListener) {
  global.addEventListener("DOMContentLoaded", runScripts, false);
} else if (global.attachEvent) {
  global.attachEvent("onload", runScripts);
}