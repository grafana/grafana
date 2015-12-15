/* */ 
"format cjs";
// https://github.com/zenparsing/es-function-bind

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  optional: true,
  stage: 0
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

function getTempId(scope) {
  var id = scope.path.getData("functionBind");
  if (id) return id;

  id = scope.generateDeclaredUidIdentifier("context");
  return scope.path.setData("functionBind", id);
}

/**
 * [Please add a description.]
 */

function getStaticContext(bind, scope) {
  var object = bind.object || bind.callee.object;
  return scope.isStatic(object) && object;
}

/**
 * [Please add a description.]
 */

function inferBindContext(bind, scope) {
  var staticContext = getStaticContext(bind, scope);
  if (staticContext) return staticContext;

  var tempId = getTempId(scope);
  if (bind.object) {
    bind.callee = t.sequenceExpression([t.assignmentExpression("=", tempId, bind.object), bind.callee]);
  } else {
    bind.callee.object = t.assignmentExpression("=", tempId, bind.callee.object);
  }
  return tempId;
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  CallExpression: function CallExpression(node, parent, scope) {
    var bind = node.callee;
    if (!t.isBindExpression(bind)) return;

    var context = inferBindContext(bind, scope);
    node.callee = t.memberExpression(bind.callee, t.identifier("call"));
    node.arguments.unshift(context);
  },

  /**
   * [Please add a description.]
   */

  BindExpression: function BindExpression(node, parent, scope) {
    var context = inferBindContext(node, scope);
    return t.callExpression(t.memberExpression(node.callee, t.identifier("bind")), [context]);
  }
};
exports.visitor = visitor;