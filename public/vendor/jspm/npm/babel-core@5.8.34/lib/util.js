/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.canCompile = canCompile;
exports.list = list;
exports.regexify = regexify;
exports.arrayify = arrayify;
exports.booleanify = booleanify;
exports.shouldIgnore = shouldIgnore;
exports.template = template;
exports.parseTemplate = parseTemplate;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashStringEscapeRegExp = require("lodash/string/escapeRegExp");

var _lodashStringEscapeRegExp2 = _interopRequireDefault(_lodashStringEscapeRegExp);

var _lodashStringStartsWith = require("lodash/string/startsWith");

var _lodashStringStartsWith2 = _interopRequireDefault(_lodashStringStartsWith);

var _lodashLangCloneDeep = require("lodash/lang/cloneDeep");

var _lodashLangCloneDeep2 = _interopRequireDefault(_lodashLangCloneDeep);

var _lodashLangIsBoolean = require("lodash/lang/isBoolean");

var _lodashLangIsBoolean2 = _interopRequireDefault(_lodashLangIsBoolean);

var _messages = require("./messages");

var messages = _interopRequireWildcard(_messages);

var _minimatch = require("minimatch");

var _minimatch2 = _interopRequireDefault(_minimatch);

var _lodashCollectionContains = require("lodash/collection/contains");

var _lodashCollectionContains2 = _interopRequireDefault(_lodashCollectionContains);

var _traversal = require("./traversal");

var _traversal2 = _interopRequireDefault(_traversal);

var _lodashLangIsString = require("lodash/lang/isString");

var _lodashLangIsString2 = _interopRequireDefault(_lodashLangIsString);

var _lodashLangIsRegExp = require("lodash/lang/isRegExp");

var _lodashLangIsRegExp2 = _interopRequireDefault(_lodashLangIsRegExp);

var _lodashLangIsEmpty = require("lodash/lang/isEmpty");

var _lodashLangIsEmpty2 = _interopRequireDefault(_lodashLangIsEmpty);

var _helpersParse = require("./helpers/parse");

var _helpersParse2 = _interopRequireDefault(_helpersParse);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _lodashObjectHas = require("lodash/object/has");

var _lodashObjectHas2 = _interopRequireDefault(_lodashObjectHas);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _types = require("./types");

var t = _interopRequireWildcard(_types);

var _slash = require("slash");

var _slash2 = _interopRequireDefault(_slash);

var _pathExists = require("path-exists");

var _pathExists2 = _interopRequireDefault(_pathExists);

var _util = require("util");

exports.inherits = _util.inherits;
exports.inspect = _util.inspect;

/**
 * Test if a filename ends with a compilable extension.
 */

function canCompile(filename, altExts) {
  var exts = altExts || canCompile.EXTENSIONS;
  var ext = _path2["default"].extname(filename);
  return _lodashCollectionContains2["default"](exts, ext);
}

/**
 * Default set of compilable extensions.
 */

canCompile.EXTENSIONS = [".js", ".jsx", ".es6", ".es"];

/**
 * Create an array from any value, splitting strings by ",".
 */

function list(val) {
  if (!val) {
    return [];
  } else if (Array.isArray(val)) {
    return val;
  } else if (typeof val === "string") {
    return val.split(",");
  } else {
    return [val];
  }
}

/**
 * Create a RegExp from a string, array, or regexp.
 */

function regexify(val) {
  if (!val) return new RegExp(/.^/);

  if (Array.isArray(val)) val = new RegExp(val.map(_lodashStringEscapeRegExp2["default"]).join("|"), "i");

  if (_lodashLangIsString2["default"](val)) {
    // normalise path separators
    val = _slash2["default"](val);

    // remove starting wildcards or relative separator if present
    if (_lodashStringStartsWith2["default"](val, "./") || _lodashStringStartsWith2["default"](val, "*/")) val = val.slice(2);
    if (_lodashStringStartsWith2["default"](val, "**/")) val = val.slice(3);

    var regex = _minimatch2["default"].makeRe(val, { nocase: true });
    return new RegExp(regex.source.slice(1, -1), "i");
  }

  if (_lodashLangIsRegExp2["default"](val)) return val;

  throw new TypeError("illegal type for regexify");
}

/**
 * Create an array from a boolean, string, or array, mapped by and optional function.
 */

function arrayify(val, mapFn) {
  if (!val) return [];
  if (_lodashLangIsBoolean2["default"](val)) return arrayify([val], mapFn);
  if (_lodashLangIsString2["default"](val)) return arrayify(list(val), mapFn);

  if (Array.isArray(val)) {
    if (mapFn) val = val.map(mapFn);
    return val;
  }

  return [val];
}

/**
 * Makes boolean-like strings into booleans.
 */

function booleanify(val) {
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}

/**
 * Tests if a filename should be ignored based on "ignore" and "only" options.
 */

function shouldIgnore(filename, ignore, only) {
  filename = _slash2["default"](filename);

  if (only) {
    var _arr = only;

    for (var _i = 0; _i < _arr.length; _i++) {
      var pattern = _arr[_i];
      if (_shouldIgnore(pattern, filename)) return false;
    }
    return true;
  } else if (ignore.length) {
    var _arr2 = ignore;

    for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
      var pattern = _arr2[_i2];
      if (_shouldIgnore(pattern, filename)) return true;
    }
  }

  return false;
}

/**
 * Returns result of calling function with filename if pattern is a function.
 * Otherwise returns result of matching pattern Regex with filename.
 */

function _shouldIgnore(pattern, filename) {
  if (typeof pattern === "function") {
    return pattern(filename);
  } else {
    return pattern.test(filename);
  }
}

/**
 * A visitor for Babel templates, replaces placeholder references.
 */

var templateVisitor = {

  /**
   * 360 NoScope PWNd
   */
  noScope: true,

  enter: function enter(node, parent, scope, nodes) {
    if (t.isExpressionStatement(node)) {
      node = node.expression;
    }

    if (t.isIdentifier(node) && _lodashObjectHas2["default"](nodes, node.name)) {
      this.skip();
      this.replaceInline(nodes[node.name]);
    }
  },

  exit: function exit(node) {
    _traversal2["default"].clearNode(node);
  }
};

/**
 * Create an instance of a template to use in a transformer.
 */

function template(name, nodes, keepExpression) {
  var ast = exports.templates[name];
  if (!ast) throw new ReferenceError("unknown template " + name);

  if (nodes === true) {
    keepExpression = true;
    nodes = null;
  }

  ast = _lodashLangCloneDeep2["default"](ast);

  if (!_lodashLangIsEmpty2["default"](nodes)) {
    _traversal2["default"](ast, templateVisitor, null, nodes);
  }

  if (ast.body.length > 1) return ast.body;

  var node = ast.body[0];

  if (!keepExpression && t.isExpressionStatement(node)) {
    return node.expression;
  } else {
    return node;
  }
}

/**
 * Parse a template.
 */

function parseTemplate(loc, code) {
  var ast = _helpersParse2["default"](code, { filename: loc, looseModules: true }).program;
  ast = _traversal2["default"].removeProperties(ast);
  return ast;
}

/**
 * Load templates from transformation/templates directory.
 */

function loadTemplates() {
  var templates = {};

  var templatesLoc = _path2["default"].join(__dirname, "transformation/templates");
  if (!_pathExists2["default"].sync(templatesLoc)) {
    throw new ReferenceError(messages.get("missingTemplatesDirectory"));
  }

  var _arr3 = _fs2["default"].readdirSync(templatesLoc);

  for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
    var name = _arr3[_i3];
    if (name[0] === ".") return;

    var key = _path2["default"].basename(name, _path2["default"].extname(name));
    var loc = _path2["default"].join(templatesLoc, name);
    var code = _fs2["default"].readFileSync(loc, "utf8");

    templates[key] = parseTemplate(loc, code);
  }

  return templates;
}

try {
  exports.templates = require("../templates.json");
} catch (err) {
  if (err.code !== "MODULE_NOT_FOUND") throw err;
  exports.templates = loadTemplates();
}