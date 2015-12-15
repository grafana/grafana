/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _generation = require("../generation");

var _generation2 = _interopRequireDefault(_generation);

var _messages = require("../messages");

var messages = _interopRequireWildcard(_messages);

var _util = require("../util");

var util = _interopRequireWildcard(_util);

var _transformationFile = require("../transformation/file");

var _transformationFile2 = _interopRequireDefault(_transformationFile);

var _lodashCollectionEach = require("lodash/collection/each");

var _lodashCollectionEach2 = _interopRequireDefault(_lodashCollectionEach);

var _types = require("../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function buildGlobal(namespace, builder) {
  var body = [];
  var container = t.functionExpression(null, [t.identifier("global")], t.blockStatement(body));
  var tree = t.program([t.expressionStatement(t.callExpression(container, [util.template("helper-self-global")]))]);

  body.push(t.variableDeclaration("var", [t.variableDeclarator(namespace, t.assignmentExpression("=", t.memberExpression(t.identifier("global"), namespace), t.objectExpression([])))]));

  builder(body);

  return tree;
}

/**
 * [Please add a description.]
 */

function buildUmd(namespace, builder) {
  var body = [];
  body.push(t.variableDeclaration("var", [t.variableDeclarator(namespace, t.identifier("global"))]));

  builder(body);

  var container = util.template("umd-commonjs-strict", {
    FACTORY_PARAMETERS: t.identifier("global"),
    BROWSER_ARGUMENTS: t.assignmentExpression("=", t.memberExpression(t.identifier("root"), namespace), t.objectExpression({})),
    COMMON_ARGUMENTS: t.identifier("exports"),
    AMD_ARGUMENTS: t.arrayExpression([t.literal("exports")]),
    FACTORY_BODY: body,
    UMD_ROOT: t.identifier("this")
  });
  return t.program([container]);
}

/**
 * [Please add a description.]
 */

function buildVar(namespace, builder) {
  var body = [];
  body.push(t.variableDeclaration("var", [t.variableDeclarator(namespace, t.objectExpression({}))]));
  builder(body);
  return t.program(body);
}

/**
 * [Please add a description.]
 */

function buildHelpers(body, namespace, whitelist) {
  _lodashCollectionEach2["default"](_transformationFile2["default"].helpers, function (name) {
    if (whitelist && whitelist.indexOf(name) === -1) return;

    var key = t.identifier(t.toIdentifier(name));
    body.push(t.expressionStatement(t.assignmentExpression("=", t.memberExpression(namespace, key), util.template("helper-" + name))));
  });
}

/**
 * [Please add a description.]
 */

exports["default"] = function (whitelist) {
  var outputType = arguments.length <= 1 || arguments[1] === undefined ? "global" : arguments[1];

  var namespace = t.identifier("babelHelpers");

  var builder = function builder(body) {
    return buildHelpers(body, namespace, whitelist);
  };

  var tree;

  var build = ({
    global: buildGlobal,
    umd: buildUmd,
    "var": buildVar
  })[outputType];

  if (build) {
    tree = build(namespace, builder);
  } else {
    throw new Error(messages.get("unsupportedOutputType", outputType));
  }

  return _generation2["default"](tree).code;
};

module.exports = exports["default"];