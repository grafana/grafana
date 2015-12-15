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

// istanbul ignore next

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _default = require("./_default");

var _default2 = _interopRequireDefault(_default);

var _amd = require("./amd");

var _amd2 = _interopRequireDefault(_amd);

var _lodashObjectValues = require("lodash/object/values");

var _lodashObjectValues2 = _interopRequireDefault(_lodashObjectValues);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _util = require("../../util");

var util = _interopRequireWildcard(_util);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var UMDFormatter = (function (_AMDFormatter) {
  _inherits(UMDFormatter, _AMDFormatter);

  function UMDFormatter() {
    _classCallCheck(this, UMDFormatter);

    _AMDFormatter.apply(this, arguments);
  }

  /**
   * [Please add a description.]
   */

  UMDFormatter.prototype.transform = function transform(program) {
    _default2["default"].prototype.transform.apply(this, arguments);

    var body = program.body;

    // build an array of module names

    var names = [];
    for (var _name in this.ids) {
      names.push(t.literal(_name));
    }

    // factory

    var ids = _lodashObjectValues2["default"](this.ids);
    var args = [t.identifier("exports")];
    if (this.passModuleArg) args.push(t.identifier("module"));
    args = args.concat(ids);

    var factory = t.functionExpression(null, args, t.blockStatement(body));

    // amd

    var defineArgs = [t.literal("exports")];
    if (this.passModuleArg) defineArgs.push(t.literal("module"));
    defineArgs = defineArgs.concat(names);
    defineArgs = [t.arrayExpression(defineArgs)];

    // common

    var testExports = util.template("test-exports");
    var testModule = util.template("test-module");
    var commonTests = this.passModuleArg ? t.logicalExpression("&&", testExports, testModule) : testExports;

    var commonArgs = [t.identifier("exports")];
    if (this.passModuleArg) commonArgs.push(t.identifier("module"));
    commonArgs = commonArgs.concat(names.map(function (name) {
      return t.callExpression(t.identifier("require"), [name]);
    }));

    // globals

    var browserArgs = [];
    if (this.passModuleArg) browserArgs.push(t.identifier("mod"));

    for (var _name2 in this.ids) {
      var id = this.defaultIds[_name2] || t.identifier(t.toIdentifier(_path2["default"].basename(_name2, _path2["default"].extname(_name2))));
      browserArgs.push(t.memberExpression(t.identifier("global"), id));
    }

    //

    var moduleName = this.getModuleName();
    if (moduleName) defineArgs.unshift(t.literal(moduleName));

    //
    var globalArg = this.file.opts.basename;
    if (moduleName) globalArg = moduleName;
    globalArg = t.identifier(t.toIdentifier(globalArg));

    var runner = util.template("umd-runner-body", {
      AMD_ARGUMENTS: defineArgs,
      COMMON_TEST: commonTests,
      COMMON_ARGUMENTS: commonArgs,
      BROWSER_ARGUMENTS: browserArgs,
      GLOBAL_ARG: globalArg
    });

    //

    program.body = [t.expressionStatement(t.callExpression(runner, [t.thisExpression(), factory]))];
  };

  return UMDFormatter;
})(_amd2["default"]);

exports["default"] = UMDFormatter;
module.exports = exports["default"];