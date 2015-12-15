/* */ 
"format cjs";
// this file contains hooks that handle ancestry cleanup of parent nodes when removing children

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * Pre hooks should be used for either rejecting removal or delegating removal
 */

var pre = [

/**
 * [Please add a description.]
 */

function (self) {
  if (self.key === "body" && (self.isBlockStatement() || self.isClassBody())) {
    // function () NODE
    // class NODE
    // attempting to remove a block statement that's someones body so let's just clear all the inner
    // statements instead
    self.node.body = [];
    return true;
  }
},

/**
 * [Please add a description.]
 */

function (self, parent) {
  var replace = false;

  // () => NODE;
  // removing the body of an arrow function
  replace = replace || self.key === "body" && parent.isArrowFunctionExpression();

  // throw NODE;
  // removing a throw statement argument
  replace = replace || self.key === "argument" && parent.isThrowStatement();

  if (replace) {
    self.replaceWith(t.identifier("undefined"));
    return true;
  }
}];

exports.pre = pre;
/**
 * Post hooks should be used for cleaning up parents
 */

var post = [

/**
 * [Please add a description.]
 */

function (self, parent) {
  var removeParent = false;

  // while (NODE);
  // removing the test of a while/switch, we can either just remove it entirely *or* turn the `test` into `true`
  // unlikely that the latter will ever be what's wanted so we just remove the loop to avoid infinite recursion
  removeParent = removeParent || self.key === "test" && (parent.isWhile() || parent.isSwitchCase());

  // export NODE;
  // just remove a declaration for an export as this is no longer valid
  removeParent = removeParent || self.key === "declaration" && parent.isExportDeclaration();

  // label: NODE
  // stray labeled statement with no body
  removeParent = removeParent || self.key === "body" && parent.isLabeledStatement();

  // var NODE;
  // remove an entire declaration if there are no declarators left
  removeParent = removeParent || self.listKey === "declarations" && parent.isVariableDeclaration() && parent.node.declarations.length === 0;

  // NODE;
  // remove the entire expression statement if there's no expression
  removeParent = removeParent || self.key === "expression" && parent.isExpressionStatement();

  // if (NODE);
  // remove the entire if since the consequent is never going to be hit, if there's an alternate then it's already been
  // handled with the `pre` hook
  removeParent = removeParent || self.key === "test" && parent.isIfStatement();

  if (removeParent) {
    parent.dangerouslyRemove();
    return true;
  }
},

/**
 * [Please add a description.]
 */

function (self, parent) {
  if (parent.isSequenceExpression() && parent.node.expressions.length === 1) {
    // (node, NODE);
    // we've just removed the second element of a sequence expression so let's turn that sequence
    // expression into a regular expression
    parent.replaceWith(parent.node.expressions[0]);
    return true;
  }
},

/**
 * [Please add a description.]
 */

function (self, parent) {
  if (parent.isBinary()) {
    // left + NODE;
    // NODE + right;
    // we're in a binary expression, better remove it and replace it with the last expression
    if (self.key === "left") {
      parent.replaceWith(parent.node.right);
    } else {
      // key === "right"
      parent.replaceWith(parent.node.left);
    }
    return true;
  }
}];
exports.post = post;