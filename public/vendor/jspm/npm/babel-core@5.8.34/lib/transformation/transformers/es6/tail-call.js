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

var _lodashCollectionReduceRight = require("lodash/collection/reduceRight");

var _lodashCollectionReduceRight2 = _interopRequireDefault(_lodashCollectionReduceRight);

var _messages = require("../../../messages");

var messages = _interopRequireWildcard(_messages);

var _lodashArrayFlatten = require("lodash/array/flatten");

var _lodashArrayFlatten2 = _interopRequireDefault(_lodashArrayFlatten);

var _util = require("../../../util");

var util = _interopRequireWildcard(_util);

var _lodashCollectionMap = require("lodash/collection/map");

var _lodashCollectionMap2 = _interopRequireDefault(_lodashCollectionMap);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  group: "builtin-trailing"
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Function: function Function(node, parent, scope, file) {
    if (node.generator || node.async) return;
    var tailCall = new TailCallTransformer(this, scope, file);
    tailCall.run();
  }
};

exports.visitor = visitor;
/**
 * [Please add a description.]
 */

function returnBlock(expr) {
  return t.blockStatement([t.returnStatement(expr)]);
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  enter: function enter(node, parent) {
    if (t.isTryStatement(parent)) {
      if (node === parent.block) {
        this.skip();
      } else if (parent.finalizer && node !== parent.finalizer) {
        this.skip();
      }
    }
  },

  /**
   * [Please add a description.]
   */

  ReturnStatement: function ReturnStatement(node, parent, scope, state) {
    return state.subTransform(node.argument);
  },

  /**
   * [Please add a description.]
   */

  Function: function Function() {
    this.skip();
  },

  /**
   * [Please add a description.]
   */

  VariableDeclaration: function VariableDeclaration(node, parent, scope, state) {
    state.vars.push(node);
  },

  /**
   * [Please add a description.]
   */

  ThisExpression: function ThisExpression(node, parent, scope, state) {
    if (!state.isShadowed) {
      state.needsThis = true;
      state.thisPaths.push(this);
    }
  },

  /**
   * [Please add a description.]
   */

  ReferencedIdentifier: function ReferencedIdentifier(node, parent, scope, state) {
    if (node.name === "arguments" && (!state.isShadowed || node._shadowedFunctionLiteral)) {
      state.needsArguments = true;
      state.argumentsPaths.push(this);
    }
  }
};

/**
 * [Please add a description.]
 */

var TailCallTransformer = (function () {
  function TailCallTransformer(path, scope, file) {
    _classCallCheck(this, TailCallTransformer);

    this.hasTailRecursion = false;

    this.needsArguments = false;
    this.argumentsPaths = [];
    this.setsArguments = false;

    this.needsThis = false;
    this.thisPaths = [];

    this.isShadowed = path.isArrowFunctionExpression() || path.is("shadow");
    this.ownerId = path.node.id;
    this.vars = [];

    this.scope = scope;
    this.path = path;
    this.file = file;
    this.node = path.node;
  }

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.getArgumentsId = function getArgumentsId() {
    return this.argumentsId = this.argumentsId || this.scope.generateUidIdentifier("arguments");
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.getThisId = function getThisId() {
    return this.thisId = this.thisId || this.scope.generateUidIdentifier("this");
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.getLeftId = function getLeftId() {
    return this.leftId = this.leftId || this.scope.generateUidIdentifier("left");
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.getFunctionId = function getFunctionId() {
    return this.functionId = this.functionId || this.scope.generateUidIdentifier("function");
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.getAgainId = function getAgainId() {
    return this.againId = this.againId || this.scope.generateUidIdentifier("again");
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.getParams = function getParams() {
    var params = this.params;

    if (!params) {
      params = this.node.params;
      this.paramDecls = [];

      for (var i = 0; i < params.length; i++) {
        var param = params[i];
        if (!param._isDefaultPlaceholder) {
          this.paramDecls.push(t.variableDeclarator(param, params[i] = this.scope.generateUidIdentifier("x")));
        }
      }
    }

    return this.params = params;
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.hasDeopt = function hasDeopt() {
    // check if the ownerId has been reassigned, if it has then it's not safe to
    // perform optimisations
    var ownerIdInfo = this.scope.getBinding(this.ownerId.name);
    return ownerIdInfo && !ownerIdInfo.constant;
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.run = function run() {
    var node = this.node;

    // only tail recursion can be optimized as for now, so we can skip anonymous
    // functions entirely
    var ownerId = this.ownerId;
    if (!ownerId) return;

    // traverse the function and look for tail recursion
    this.path.traverse(visitor, this);

    // has no tail call recursion
    if (!this.hasTailRecursion) return;

    // the function binding isn't constant so we can't be sure that it's the same function :(
    if (this.hasDeopt()) {
      this.file.log.deopt(node, messages.get("tailCallReassignmentDeopt"));
      return;
    }

    //

    var body = this.path.ensureBlock().body;

    for (var i = 0; i < body.length; i++) {
      var bodyNode = body[i];
      if (!t.isFunctionDeclaration(bodyNode)) continue;

      bodyNode = body[i] = t.variableDeclaration("var", [t.variableDeclarator(bodyNode.id, t.toExpression(bodyNode))]);
      bodyNode._blockHoist = 2;
    }

    var paramDecls = this.paramDecls;
    if (paramDecls.length > 0) {
      var paramDecl = t.variableDeclaration("var", paramDecls);
      paramDecl._blockHoist = Infinity;
      body.unshift(paramDecl);
    }

    body.unshift(t.expressionStatement(t.assignmentExpression("=", this.getAgainId(), t.literal(false))));

    node.body = util.template("tail-call-body", {
      FUNCTION_ID: this.getFunctionId(),
      AGAIN_ID: this.getAgainId(),
      BLOCK: node.body
    });

    var topVars = [];

    if (this.needsThis) {
      var _arr = this.thisPaths;

      for (var _i = 0; _i < _arr.length; _i++) {
        var path = _arr[_i];
        path.replaceWith(this.getThisId());
      }

      topVars.push(t.variableDeclarator(this.getThisId(), t.thisExpression()));
    }

    if (this.needsArguments || this.setsArguments) {
      var _arr2 = this.argumentsPaths;

      for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
        var _path = _arr2[_i2];
        _path.replaceWith(this.argumentsId);
      }

      var decl = t.variableDeclarator(this.argumentsId);
      if (this.argumentsId) {
        decl.init = t.identifier("arguments");
        decl.init._shadowedFunctionLiteral = this.path;
      }
      topVars.push(decl);
    }

    var leftId = this.leftId;
    if (leftId) {
      topVars.push(t.variableDeclarator(leftId));
    }

    if (topVars.length > 0) {
      node.body.body.unshift(t.variableDeclaration("var", topVars));
    }
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.subTransform = function subTransform(node) {
    if (!node) return;

    var handler = this["subTransform" + node.type];
    if (handler) return handler.call(this, node);
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.subTransformConditionalExpression = function subTransformConditionalExpression(node) {
    var callConsequent = this.subTransform(node.consequent);
    var callAlternate = this.subTransform(node.alternate);
    if (!callConsequent && !callAlternate) {
      return;
    }

    // if ternary operator had tail recursion in value, convert to optimized if-statement
    node.type = "IfStatement";
    node.consequent = callConsequent ? t.toBlock(callConsequent) : returnBlock(node.consequent);

    if (callAlternate) {
      node.alternate = t.isIfStatement(callAlternate) ? callAlternate : t.toBlock(callAlternate);
    } else {
      node.alternate = returnBlock(node.alternate);
    }

    return [node];
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.subTransformLogicalExpression = function subTransformLogicalExpression(node) {
    // only call in right-value of can be optimized
    var callRight = this.subTransform(node.right);
    if (!callRight) return;

    // cache left value as it might have side-effects
    var leftId = this.getLeftId();
    var testExpr = t.assignmentExpression("=", leftId, node.left);

    if (node.operator === "&&") {
      testExpr = t.unaryExpression("!", testExpr);
    }

    return [t.ifStatement(testExpr, returnBlock(leftId))].concat(callRight);
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.subTransformSequenceExpression = function subTransformSequenceExpression(node) {
    var seq = node.expressions;

    // only last element can be optimized
    var lastCall = this.subTransform(seq[seq.length - 1]);
    if (!lastCall) {
      return;
    }

    // remove converted expression from sequence
    // and convert to regular expression if needed
    if (--seq.length === 1) {
      node = seq[0];
    }

    return [t.expressionStatement(node)].concat(lastCall);
  };

  /**
   * [Please add a description.]
   */

  TailCallTransformer.prototype.subTransformCallExpression = function subTransformCallExpression(node) {
    var callee = node.callee;
    var thisBinding, args;

    if (t.isMemberExpression(callee, { computed: false }) && t.isIdentifier(callee.property)) {
      switch (callee.property.name) {
        case "call":
          args = t.arrayExpression(node.arguments.slice(1));
          break;

        case "apply":
          args = node.arguments[1] || t.identifier("undefined");
          this.needsArguments = true;
          break;

        default:
          return;
      }

      thisBinding = node.arguments[0];
      callee = callee.object;
    }

    // only tail recursion can be optimized as for now
    if (!t.isIdentifier(callee) || !this.scope.bindingIdentifierEquals(callee.name, this.ownerId)) {
      return;
    }

    this.hasTailRecursion = true;

    if (this.hasDeopt()) return;

    var body = [];

    if (this.needsThis && !t.isThisExpression(thisBinding)) {
      body.push(t.expressionStatement(t.assignmentExpression("=", this.getThisId(), thisBinding || t.identifier("undefined"))));
    }

    if (!args) {
      args = t.arrayExpression(node.arguments);
    }

    var argumentsId = this.getArgumentsId();
    var params = this.getParams();

    if (this.needsArguments) {
      body.push(t.expressionStatement(t.assignmentExpression("=", argumentsId, args)));
    }

    if (t.isArrayExpression(args)) {
      var elems = args.elements;

      // pad out the args so all the function args are reset - https://github.com/babel/babel/issues/1938
      while (elems.length < params.length) {
        elems.push(t.identifier("undefined"));
      }

      for (var i = 0; i < elems.length; i++) {
        var param = params[i];
        var elem = elems[i];

        if (param && !param._isDefaultPlaceholder) {
          elems[i] = t.assignmentExpression("=", param, elem);
        } else {
          // exceeds parameters but push it anyway to ensure correct execution
        }
      }

      if (!this.needsArguments) {
        var _arr3 = elems;

        for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
          var elem = _arr3[_i3];
          // only push expressions that we really need, this will skip pure arguments that exceed the
          // parameter length of the current function
          if (!this.scope.isPure(elem)) {
            body.push(t.expressionStatement(elem));
          }
        }
      }
    } else {
      this.setsArguments = true;
      for (var i = 0; i < params.length; i++) {
        var param = params[i];
        if (!param._isDefaultPlaceholder) {
          body.push(t.expressionStatement(t.assignmentExpression("=", param, t.memberExpression(argumentsId, t.literal(i), true))));
        }
      }
    }

    body.push(t.expressionStatement(t.assignmentExpression("=", this.getAgainId(), t.literal(true))));

    if (this.vars.length > 0) {
      var declarations = _lodashArrayFlatten2["default"](_lodashCollectionMap2["default"](this.vars, function (decl) {
        return decl.declarations;
      }));

      var assignment = _lodashCollectionReduceRight2["default"](declarations, function (expr, decl) {
        return t.assignmentExpression("=", decl.id, expr);
      }, t.identifier("undefined"));

      var statement = t.expressionStatement(assignment);
      body.push(statement);
    }

    body.push(t.continueStatement(this.getFunctionId()));

    return body;
  };

  return TailCallTransformer;
})();