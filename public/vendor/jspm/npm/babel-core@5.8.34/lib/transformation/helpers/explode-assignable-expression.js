/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var getObjRef = function getObjRef(node, nodes, file, scope) {
  var ref;
  if (t.isIdentifier(node)) {
    if (scope.hasBinding(node.name)) {
      // this variable is declared in scope so we can be 100% sure
      // that evaluating it multiple times wont trigger a getter
      // or something else
      return node;
    } else {
      // could possibly trigger a getter so we need to only evaluate
      // it once
      ref = node;
    }
  } else if (t.isMemberExpression(node)) {
    ref = node.object;

    if (t.isIdentifier(ref) && scope.hasGlobal(ref.name)) {
      // the object reference that we need to save is locally declared
      // so as per the previous comment we can be 100% sure evaluating
      // it multiple times will be safe
      return ref;
    }
  } else {
    throw new Error("We can't explode this node type " + node.type);
  }

  var temp = scope.generateUidIdentifierBasedOnNode(ref);
  nodes.push(t.variableDeclaration("var", [t.variableDeclarator(temp, ref)]));
  return temp;
};

/**
 * [Please add a description.]
 */

var getPropRef = function getPropRef(node, nodes, file, scope) {
  var prop = node.property;
  var key = t.toComputedKey(node, prop);
  if (t.isLiteral(key)) return key;

  var temp = scope.generateUidIdentifierBasedOnNode(prop);
  nodes.push(t.variableDeclaration("var", [t.variableDeclarator(temp, prop)]));
  return temp;
};

/**
 * [Please add a description.]
 */

exports["default"] = function (node, nodes, file, scope, allowedSingleIdent) {
  var obj;
  if (t.isIdentifier(node) && allowedSingleIdent) {
    obj = node;
  } else {
    obj = getObjRef(node, nodes, file, scope);
  }

  var ref, uid;

  if (t.isIdentifier(node)) {
    ref = node;
    uid = obj;
  } else {
    var prop = getPropRef(node, nodes, file, scope);
    var computed = node.computed || t.isLiteral(prop);
    uid = ref = t.memberExpression(obj, prop, computed);
  }

  return {
    uid: uid,
    ref: ref
  };
};

module.exports = exports["default"];