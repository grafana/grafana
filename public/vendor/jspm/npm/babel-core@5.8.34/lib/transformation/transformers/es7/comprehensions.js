/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _helpersBuildComprehension = require("../../helpers/build-comprehension");

var _helpersBuildComprehension2 = _interopRequireDefault(_helpersBuildComprehension);

var _traversal = require("../../../traversal");

var _traversal2 = _interopRequireDefault(_traversal);

var _util = require("../../../util");

var util = _interopRequireWildcard(_util);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  stage: 0
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ComprehensionExpression: function ComprehensionExpression(node, parent, scope) {
    var callback = array;
    if (node.generator) callback = generator;
    return callback(node, parent, scope);
  }
};

exports.visitor = visitor;
/**
 * [Please add a description.]
 */

function generator(node) {
  var body = [];
  var container = t.functionExpression(null, [], t.blockStatement(body), true);
  container.shadow = true;

  body.push(_helpersBuildComprehension2["default"](node, function () {
    return t.expressionStatement(t.yieldExpression(node.body));
  }));

  return t.callExpression(container, []);
}

/**
 * [Please add a description.]
 */

function array(node, parent, scope) {
  var uid = scope.generateUidIdentifierBasedOnNode(parent);

  var container = util.template("array-comprehension-container", {
    KEY: uid
  });
  container.callee.shadow = true;

  var block = container.callee.body;
  var body = block.body;

  if (_traversal2["default"].hasType(node, scope, "YieldExpression", t.FUNCTION_TYPES)) {
    container.callee.generator = true;
    container = t.yieldExpression(container, true);
  }

  var returnStatement = body.pop();

  body.push(_helpersBuildComprehension2["default"](node, function () {
    return util.template("array-push", {
      STATEMENT: node.body,
      KEY: uid
    }, true);
  }));
  body.push(returnStatement);

  return container;
}