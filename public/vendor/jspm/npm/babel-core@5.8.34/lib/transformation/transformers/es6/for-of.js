/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports._ForOfStatementArray = _ForOfStatementArray;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _messages = require("../../../messages");

var messages = _interopRequireWildcard(_messages);

var _util = require("../../../util");

var util = _interopRequireWildcard(_util);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ForOfStatement: function ForOfStatement(node, parent, scope, file) {
    if (this.get("right").isArrayExpression()) {
      return _ForOfStatementArray.call(this, node, scope, file);
    }

    var callback = spec;
    if (file.isLoose("es6.forOf")) callback = loose;

    var build = callback(node, parent, scope, file);
    var declar = build.declar;
    var loop = build.loop;
    var block = loop.body;

    // ensure that it's a block so we can take all its statements
    this.ensureBlock();

    // add the value declaration to the new loop body
    if (declar) {
      block.body.push(declar);
    }

    // push the rest of the original loop body onto our new body
    block.body = block.body.concat(node.body.body);

    t.inherits(loop, node);
    t.inherits(loop.body, node.body);

    if (build.replaceParent) {
      this.parentPath.replaceWithMultiple(build.node);
      this.dangerouslyRemove();
    } else {
      return build.node;
    }
  }
};

exports.visitor = visitor;
/**
 * [Please add a description.]
 */

function _ForOfStatementArray(node, scope) {
  var nodes = [];
  var right = node.right;

  if (!t.isIdentifier(right) || !scope.hasBinding(right.name)) {
    var uid = scope.generateUidIdentifier("arr");
    nodes.push(t.variableDeclaration("var", [t.variableDeclarator(uid, right)]));
    right = uid;
  }

  var iterationKey = scope.generateUidIdentifier("i");

  var loop = util.template("for-of-array", {
    BODY: node.body,
    KEY: iterationKey,
    ARR: right
  });

  t.inherits(loop, node);
  t.ensureBlock(loop);

  var iterationValue = t.memberExpression(right, iterationKey, true);

  var left = node.left;
  if (t.isVariableDeclaration(left)) {
    left.declarations[0].init = iterationValue;
    loop.body.body.unshift(left);
  } else {
    loop.body.body.unshift(t.expressionStatement(t.assignmentExpression("=", left, iterationValue)));
  }

  if (this.parentPath.isLabeledStatement()) {
    loop = t.labeledStatement(this.parentPath.node.label, loop);
  }

  nodes.push(loop);

  return nodes;
}

/**
 * [Please add a description.]
 */

var loose = function loose(node, parent, scope, file) {
  var left = node.left;
  var declar, id;

  if (t.isIdentifier(left) || t.isPattern(left) || t.isMemberExpression(left)) {
    // for (i of test), for ({ i } of test)
    id = left;
  } else if (t.isVariableDeclaration(left)) {
    // for (var i of test)
    id = scope.generateUidIdentifier("ref");
    declar = t.variableDeclaration(left.kind, [t.variableDeclarator(left.declarations[0].id, id)]);
  } else {
    throw file.errorWithNode(left, messages.get("unknownForHead", left.type));
  }

  var iteratorKey = scope.generateUidIdentifier("iterator");
  var isArrayKey = scope.generateUidIdentifier("isArray");

  var loop = util.template("for-of-loose", {
    LOOP_OBJECT: iteratorKey,
    IS_ARRAY: isArrayKey,
    OBJECT: node.right,
    INDEX: scope.generateUidIdentifier("i"),
    ID: id
  });

  if (!declar) {
    // no declaration so we need to remove the variable declaration at the top of
    // the for-of-loose template
    loop.body.body.shift();
  }

  //

  return {
    declar: declar,
    node: loop,
    loop: loop
  };
};

/**
 * [Please add a description.]
 */

var spec = function spec(node, parent, scope, file) {
  var left = node.left;
  var declar;

  var stepKey = scope.generateUidIdentifier("step");
  var stepValue = t.memberExpression(stepKey, t.identifier("value"));

  if (t.isIdentifier(left) || t.isPattern(left) || t.isMemberExpression(left)) {
    // for (i of test), for ({ i } of test)
    declar = t.expressionStatement(t.assignmentExpression("=", left, stepValue));
  } else if (t.isVariableDeclaration(left)) {
    // for (var i of test)
    declar = t.variableDeclaration(left.kind, [t.variableDeclarator(left.declarations[0].id, stepValue)]);
  } else {
    throw file.errorWithNode(left, messages.get("unknownForHead", left.type));
  }

  //

  var iteratorKey = scope.generateUidIdentifier("iterator");

  var template = util.template("for-of", {
    ITERATOR_HAD_ERROR_KEY: scope.generateUidIdentifier("didIteratorError"),
    ITERATOR_COMPLETION: scope.generateUidIdentifier("iteratorNormalCompletion"),
    ITERATOR_ERROR_KEY: scope.generateUidIdentifier("iteratorError"),
    ITERATOR_KEY: iteratorKey,
    STEP_KEY: stepKey,
    OBJECT: node.right,
    BODY: null
  });

  var isLabeledParent = t.isLabeledStatement(parent);

  var tryBody = template[3].block.body;
  var loop = tryBody[0];

  if (isLabeledParent) {
    tryBody[0] = t.labeledStatement(parent.label, loop);
  }

  //

  return {
    replaceParent: isLabeledParent,
    declar: declar,
    loop: loop,
    node: template
  };
};