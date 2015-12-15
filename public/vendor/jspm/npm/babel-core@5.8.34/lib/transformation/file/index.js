/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _convertSourceMap = require("convert-source-map");

var _convertSourceMap2 = _interopRequireDefault(_convertSourceMap);

var _modules = require("../modules");

var _modules2 = _interopRequireDefault(_modules);

var _optionsOptionManager = require("./options/option-manager");

var _optionsOptionManager2 = _interopRequireDefault(_optionsOptionManager);

var _pluginManager = require("./plugin-manager");

var _pluginManager2 = _interopRequireDefault(_pluginManager);

var _shebangRegex = require("shebang-regex");

var _shebangRegex2 = _interopRequireDefault(_shebangRegex);

var _traversalPath = require("../../traversal/path");

var _traversalPath2 = _interopRequireDefault(_traversalPath);

var _lodashLangIsFunction = require("lodash/lang/isFunction");

var _lodashLangIsFunction2 = _interopRequireDefault(_lodashLangIsFunction);

var _sourceMap = require("source-map");

var _sourceMap2 = _interopRequireDefault(_sourceMap);

var _generation = require("../../generation");

var _generation2 = _interopRequireDefault(_generation);

var _helpersCodeFrame = require("../../helpers/code-frame");

var _helpersCodeFrame2 = _interopRequireDefault(_helpersCodeFrame);

var _lodashObjectDefaults = require("lodash/object/defaults");

var _lodashObjectDefaults2 = _interopRequireDefault(_lodashObjectDefaults);

var _lodashCollectionIncludes = require("lodash/collection/includes");

var _lodashCollectionIncludes2 = _interopRequireDefault(_lodashCollectionIncludes);

var _traversal = require("../../traversal");

var _traversal2 = _interopRequireDefault(_traversal);

var _tryResolve = require("try-resolve");

var _tryResolve2 = _interopRequireDefault(_tryResolve);

var _logger = require("./logger");

var _logger2 = _interopRequireDefault(_logger);

var _plugin = require("../plugin");

var _plugin2 = _interopRequireDefault(_plugin);

var _helpersParse = require("../../helpers/parse");

var _helpersParse2 = _interopRequireDefault(_helpersParse);

var _traversalHub = require("../../traversal/hub");

var _traversalHub2 = _interopRequireDefault(_traversalHub);

var _util = require("../../util");

var util = _interopRequireWildcard(_util);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var File = (function () {
  function File(opts, pipeline) {
    if (opts === undefined) opts = {};

    _classCallCheck(this, File);

    this.transformerDependencies = {};
    this.dynamicImportTypes = {};
    this.dynamicImportIds = {};
    this.dynamicImports = [];
    this.declarations = {};
    this.usedHelpers = {};
    this.dynamicData = {};
    this.data = {};
    this.ast = {};
    this.metadata = {
      modules: {
        imports: [],
        exports: {
          exported: [],
          specifiers: []
        }
      }
    };
    this.hub = new _traversalHub2["default"](this);

    this.pipeline = pipeline;

    this.log = new _logger2["default"](this, opts.filename || "unknown");
    this.opts = this.initOptions(opts);

    this.buildTransformers();
  }

  /**
   * [Please add a description.]
   */

  File.prototype.initOptions = function initOptions(opts) {
    opts = new _optionsOptionManager2["default"](this.log, this.pipeline).init(opts);

    if (opts.inputSourceMap) {
      opts.sourceMaps = true;
    }

    if (opts.moduleId) {
      opts.moduleIds = true;
    }

    opts.basename = _path2["default"].basename(opts.filename, _path2["default"].extname(opts.filename));

    opts.ignore = util.arrayify(opts.ignore, util.regexify);

    if (opts.only) opts.only = util.arrayify(opts.only, util.regexify);

    _lodashObjectDefaults2["default"](opts, {
      moduleRoot: opts.sourceRoot
    });

    _lodashObjectDefaults2["default"](opts, {
      sourceRoot: opts.moduleRoot
    });

    _lodashObjectDefaults2["default"](opts, {
      filenameRelative: opts.filename
    });

    _lodashObjectDefaults2["default"](opts, {
      sourceFileName: opts.filenameRelative,
      sourceMapTarget: opts.filenameRelative
    });

    //

    if (opts.externalHelpers) {
      this.set("helpersNamespace", t.identifier("babelHelpers"));
    }

    return opts;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.isLoose = function isLoose(key) {
    return _lodashCollectionIncludes2["default"](this.opts.loose, key);
  };

  /**
   * [Please add a description.]
   */

  File.prototype.buildTransformers = function buildTransformers() {
    var file = this;

    var transformers = this.transformers = {};

    var secondaryStack = [];
    var stack = [];

    // build internal transformers
    for (var key in this.pipeline.transformers) {
      var transformer = this.pipeline.transformers[key];
      var pass = transformers[key] = transformer.buildPass(file);

      if (pass.canTransform()) {
        stack.push(pass);

        if (transformer.metadata.secondPass) {
          secondaryStack.push(pass);
        }

        if (transformer.manipulateOptions) {
          transformer.manipulateOptions(file.opts, file);
        }
      }
    }

    // init plugins!
    var beforePlugins = [];
    var afterPlugins = [];
    var pluginManager = new _pluginManager2["default"]({
      file: this,
      transformers: this.transformers,
      before: beforePlugins,
      after: afterPlugins
    });
    for (var i = 0; i < file.opts.plugins.length; i++) {
      pluginManager.add(file.opts.plugins[i]);
    }
    stack = beforePlugins.concat(stack, afterPlugins);

    // build transformer stack
    this.uncollapsedTransformerStack = stack = stack.concat(secondaryStack);

    // build dependency graph
    var _arr = stack;
    for (var _i = 0; _i < _arr.length; _i++) {
      var pass = _arr[_i];var _arr2 = pass.plugin.dependencies;

      for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
        var dep = _arr2[_i2];
        this.transformerDependencies[dep] = pass.key;
      }
    }

    // collapse stack categories
    this.transformerStack = this.collapseStack(stack);
  };

  /**
   * [Please add a description.]
   */

  File.prototype.collapseStack = function collapseStack(_stack) {
    var stack = [];
    var ignore = [];

    var _arr3 = _stack;
    for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
      var pass = _arr3[_i3];
      // been merged
      if (ignore.indexOf(pass) >= 0) continue;

      var group = pass.plugin.metadata.group;

      // can't merge
      if (!pass.canTransform() || !group) {
        stack.push(pass);
        continue;
      }

      var mergeStack = [];
      var _arr4 = _stack;
      for (var _i4 = 0; _i4 < _arr4.length; _i4++) {
        var _pass = _arr4[_i4];
        if (_pass.plugin.metadata.group === group) {
          mergeStack.push(_pass);
          ignore.push(_pass);
        }
      }

      var visitors = [];
      var _arr5 = mergeStack;
      for (var _i5 = 0; _i5 < _arr5.length; _i5++) {
        var _pass2 = _arr5[_i5];
        visitors.push(_pass2.plugin.visitor);
      }
      var visitor = _traversal2["default"].visitors.merge(visitors);
      var mergePlugin = new _plugin2["default"](group, { visitor: visitor });
      stack.push(mergePlugin.buildPass(this));
    }

    return stack;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.set = function set(key, val) {
    return this.data[key] = val;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.setDynamic = function setDynamic(key, fn) {
    this.dynamicData[key] = fn;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.get = function get(key) {
    var data = this.data[key];
    if (data) {
      return data;
    } else {
      var dynamic = this.dynamicData[key];
      if (dynamic) {
        return this.set(key, dynamic());
      }
    }
  };

  /**
   * [Please add a description.]
   */

  File.prototype.resolveModuleSource = function resolveModuleSource(source) {
    var resolveModuleSource = this.opts.resolveModuleSource;
    if (resolveModuleSource) source = resolveModuleSource(source, this.opts.filename);
    return source;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.addImport = function addImport(source, name, type) {
    name = name || source;
    var id = this.dynamicImportIds[name];

    if (!id) {
      source = this.resolveModuleSource(source);
      id = this.dynamicImportIds[name] = this.scope.generateUidIdentifier(name);

      var specifiers = [t.importDefaultSpecifier(id)];
      var declar = t.importDeclaration(specifiers, t.literal(source));
      declar._blockHoist = 3;

      if (type) {
        var modules = this.dynamicImportTypes[type] = this.dynamicImportTypes[type] || [];
        modules.push(declar);
      }

      if (this.transformers["es6.modules"].canTransform()) {
        this.moduleFormatter.importSpecifier(specifiers[0], declar, this.dynamicImports, this.scope);
        this.moduleFormatter.hasLocalImports = true;
      } else {
        this.dynamicImports.push(declar);
      }
    }

    return id;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.attachAuxiliaryComment = function attachAuxiliaryComment(node) {
    var beforeComment = this.opts.auxiliaryCommentBefore;
    if (beforeComment) {
      node.leadingComments = node.leadingComments || [];
      node.leadingComments.push({
        type: "CommentLine",
        value: " " + beforeComment
      });
    }

    var afterComment = this.opts.auxiliaryCommentAfter;
    if (afterComment) {
      node.trailingComments = node.trailingComments || [];
      node.trailingComments.push({
        type: "CommentLine",
        value: " " + afterComment
      });
    }

    return node;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.addHelper = function addHelper(name) {
    var isSolo = _lodashCollectionIncludes2["default"](File.soloHelpers, name);

    if (!isSolo && !_lodashCollectionIncludes2["default"](File.helpers, name)) {
      throw new ReferenceError("Unknown helper " + name);
    }

    var declar = this.declarations[name];
    if (declar) return declar;

    this.usedHelpers[name] = true;

    if (!isSolo) {
      var generator = this.get("helperGenerator");
      var runtime = this.get("helpersNamespace");
      if (generator) {
        return generator(name);
      } else if (runtime) {
        var id = t.identifier(t.toIdentifier(name));
        return t.memberExpression(runtime, id);
      }
    }

    var ref = util.template("helper-" + name);

    var uid = this.declarations[name] = this.scope.generateUidIdentifier(name);

    if (t.isFunctionExpression(ref) && !ref.id) {
      ref.body._compact = true;
      ref._generated = true;
      ref.id = uid;
      ref.type = "FunctionDeclaration";
      this.attachAuxiliaryComment(ref);
      this.path.unshiftContainer("body", ref);
    } else {
      ref._compact = true;
      this.scope.push({
        id: uid,
        init: ref,
        unique: true
      });
    }

    return uid;
  };

  File.prototype.addTemplateObject = function addTemplateObject(helperName, strings, raw) {
    // Generate a unique name based on the string literals so we dedupe
    // identical strings used in the program.
    var stringIds = raw.elements.map(function (string) {
      return string.value;
    });
    var name = helperName + "_" + raw.elements.length + "_" + stringIds.join(",");

    var declar = this.declarations[name];
    if (declar) return declar;

    var uid = this.declarations[name] = this.scope.generateUidIdentifier("templateObject");

    var helperId = this.addHelper(helperName);
    var init = t.callExpression(helperId, [strings, raw]);
    init._compact = true;
    this.scope.push({
      id: uid,
      init: init,
      _blockHoist: 1.9 // This ensures that we don't fail if not using function expression helpers
    });
    return uid;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.errorWithNode = function errorWithNode(node, msg) {
    var Error = arguments.length <= 2 || arguments[2] === undefined ? SyntaxError : arguments[2];

    var err;
    var loc = node && (node.loc || node._loc);
    if (loc) {
      err = new Error("Line " + loc.start.line + ": " + msg);
      err.loc = loc.start;
    } else {
      // todo: find errors with nodes inside to at least point to something
      err = new Error("There's been an error on a dynamic node. This is almost certainly an internal error. Please report it.");
    }
    return err;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.mergeSourceMap = function mergeSourceMap(map) {
    var opts = this.opts;

    var inputMap = opts.inputSourceMap;

    if (inputMap) {
      map.sources[0] = inputMap.file;

      var inputMapConsumer = new _sourceMap2["default"].SourceMapConsumer(inputMap);
      var outputMapConsumer = new _sourceMap2["default"].SourceMapConsumer(map);
      var outputMapGenerator = _sourceMap2["default"].SourceMapGenerator.fromSourceMap(outputMapConsumer);
      outputMapGenerator.applySourceMap(inputMapConsumer);

      var mergedMap = outputMapGenerator.toJSON();
      mergedMap.sources = inputMap.sources;
      mergedMap.file = inputMap.file;
      return mergedMap;
    }

    return map;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.getModuleFormatter = function getModuleFormatter(type) {
    if (_lodashLangIsFunction2["default"](type) || !_modules2["default"][type]) {
      this.log.deprecate("Custom module formatters are deprecated and will be removed in the next major. Please use Babel plugins instead.");
    }

    var ModuleFormatter = _lodashLangIsFunction2["default"](type) ? type : _modules2["default"][type];

    if (!ModuleFormatter) {
      var loc = _tryResolve2["default"].relative(type);
      if (loc) ModuleFormatter = require(loc);
    }

    if (!ModuleFormatter) {
      throw new ReferenceError("Unknown module formatter type " + JSON.stringify(type));
    }

    return new ModuleFormatter(this);
  };

  /**
   * [Please add a description.]
   */

  File.prototype.parse = function parse(code) {
    var opts = this.opts;

    //

    var parseOpts = {
      highlightCode: opts.highlightCode,
      nonStandard: opts.nonStandard,
      sourceType: opts.sourceType,
      filename: opts.filename,
      plugins: {}
    };

    var features = parseOpts.features = {};
    for (var key in this.transformers) {
      var transformer = this.transformers[key];
      features[key] = transformer.canTransform();
    }

    parseOpts.looseModules = this.isLoose("es6.modules");
    parseOpts.strictMode = features.strict;

    this.log.debug("Parse start");
    var ast = _helpersParse2["default"](code, parseOpts);
    this.log.debug("Parse stop");
    return ast;
  };

  /**
   * [Please add a description.]
   */

  File.prototype._addAst = function _addAst(ast) {
    this.path = _traversalPath2["default"].get({
      hub: this.hub,
      parentPath: null,
      parent: ast,
      container: ast,
      key: "program"
    }).setContext();
    this.scope = this.path.scope;
    this.ast = ast;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.addAst = function addAst(ast) {
    this.log.debug("Start set AST");
    this._addAst(ast);
    this.log.debug("End set AST");

    this.log.debug("Start module formatter init");
    var modFormatter = this.moduleFormatter = this.getModuleFormatter(this.opts.modules);
    if (modFormatter.init && this.transformers["es6.modules"].canTransform()) {
      modFormatter.init();
    }
    this.log.debug("End module formatter init");
  };

  /**
   * [Please add a description.]
   */

  File.prototype.transform = function transform() {
    this.call("pre");
    var _arr6 = this.transformerStack;
    for (var _i6 = 0; _i6 < _arr6.length; _i6++) {
      var pass = _arr6[_i6];
      pass.transform();
    }
    this.call("post");

    return this.generate();
  };

  /**
   * [Please add a description.]
   */

  File.prototype.wrap = function wrap(code, callback) {
    code = code + "";

    try {
      if (this.shouldIgnore()) {
        return this.makeResult({ code: code, ignored: true });
      } else {
        return callback();
      }
    } catch (err) {
      if (err._babel) {
        throw err;
      } else {
        err._babel = true;
      }

      var message = err.message = this.opts.filename + ": " + err.message;

      var loc = err.loc;
      if (loc) {
        err.codeFrame = _helpersCodeFrame2["default"](code, loc.line, loc.column + 1, this.opts);
        message += "\n" + err.codeFrame;
      }

      if (process.browser) {
        // chrome has it's own pretty stringifier which doesn't use the stack property
        // https://github.com/babel/babel/issues/2175
        err.message = message;
      }

      if (err.stack) {
        var newStack = err.stack.replace(err.message, message);
        try {
          err.stack = newStack;
        } catch (e) {
          // `err.stack` may be a readonly property in some environments
        }
      }

      throw err;
    }
  };

  /**
   * [Please add a description.]
   */

  File.prototype.addCode = function addCode(code) {
    code = (code || "") + "";
    code = this.parseInputSourceMap(code);
    this.code = code;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.parseCode = function parseCode() {
    this.parseShebang();
    var ast = this.parse(this.code);
    this.addAst(ast);
  };

  /**
   * [Please add a description.]
   */

  File.prototype.shouldIgnore = function shouldIgnore() {
    var opts = this.opts;
    return util.shouldIgnore(opts.filename, opts.ignore, opts.only);
  };

  /**
   * [Please add a description.]
   */

  File.prototype.call = function call(key) {
    var _arr7 = this.uncollapsedTransformerStack;

    for (var _i7 = 0; _i7 < _arr7.length; _i7++) {
      var pass = _arr7[_i7];
      var fn = pass.plugin[key];
      if (fn) fn(this);
    }
  };

  /**
   * [Please add a description.]
   */

  File.prototype.parseInputSourceMap = function parseInputSourceMap(code) {
    var opts = this.opts;

    if (opts.inputSourceMap !== false) {
      var inputMap = _convertSourceMap2["default"].fromSource(code);
      if (inputMap) {
        opts.inputSourceMap = inputMap.toObject();
        code = _convertSourceMap2["default"].removeComments(code);
      }
    }

    return code;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.parseShebang = function parseShebang() {
    var shebangMatch = _shebangRegex2["default"].exec(this.code);
    if (shebangMatch) {
      this.shebang = shebangMatch[0];
      this.code = this.code.replace(_shebangRegex2["default"], "");
    }
  };

  /**
   * [Please add a description.]
   */

  File.prototype.makeResult = function makeResult(_ref) {
    var code = _ref.code;
    var _ref$map = _ref.map;
    var map = _ref$map === undefined ? null : _ref$map;
    var ast = _ref.ast;
    var ignored = _ref.ignored;

    var result = {
      metadata: null,
      ignored: !!ignored,
      code: null,
      ast: null,
      map: map
    };

    if (this.opts.code) {
      result.code = code;
    }

    if (this.opts.ast) {
      result.ast = ast;
    }

    if (this.opts.metadata) {
      result.metadata = this.metadata;
      result.metadata.usedHelpers = Object.keys(this.usedHelpers);
    }

    return result;
  };

  /**
   * [Please add a description.]
   */

  File.prototype.generate = function generate() {
    var opts = this.opts;
    var ast = this.ast;

    var result = { ast: ast };
    if (!opts.code) return this.makeResult(result);

    this.log.debug("Generation start");

    var _result = _generation2["default"](ast, opts, this.code);
    result.code = _result.code;
    result.map = _result.map;

    this.log.debug("Generation end");

    if (this.shebang) {
      // add back shebang
      result.code = this.shebang + "\n" + result.code;
    }

    if (result.map) {
      result.map = this.mergeSourceMap(result.map);
    }

    if (opts.sourceMaps === "inline" || opts.sourceMaps === "both") {
      result.code += "\n" + _convertSourceMap2["default"].fromObject(result.map).toComment();
    }

    if (opts.sourceMaps === "inline") {
      result.map = null;
    }

    return this.makeResult(result);
  };

  _createClass(File, null, [{
    key: "helpers",

    /**
     * [Please add a description.]
     */

    value: ["inherits", "defaults", "create-class", "create-decorated-class", "create-decorated-object", "define-decorated-property-descriptor", "tagged-template-literal", "tagged-template-literal-loose", "to-array", "to-consumable-array", "sliced-to-array", "sliced-to-array-loose", "object-without-properties", "has-own", "slice", "bind", "define-property", "async-to-generator", "interop-export-wildcard", "interop-require-wildcard", "interop-require-default", "typeof", "extends", "get", "set", "new-arrow-check", "class-call-check", "object-destructuring-empty", "temporal-undefined", "temporal-assert-defined", "self-global", "typeof-react-element", "default-props", "instanceof",

    // legacy
    "interop-require"],

    /**
     * [Please add a description.]
     */

    enumerable: true
  }, {
    key: "soloHelpers",
    value: [],
    enumerable: true
  }]);

  return File;
})();

exports["default"] = File;
module.exports = exports["default"];