/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _util = require("../../../../util");

var util = _interopRequireWildcard(_util);

var _types = require("../../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var memberExpressionOptimisationVisitor = {

  /**
   * [Please add a description.]
   */

  Scope: function Scope(node, parent, scope, state) {
    // check if this scope has a local binding that will shadow the rest parameter
    if (!scope.bindingIdentifierEquals(state.name, state.outerBinding)) {
      this.skip();
    }
  },

  /**
   * [Please add a description.]
   */

  Flow: function Flow() {
    // don't touch reference in type annotations
    this.skip();
  },

  /**
   * [Please add a description.]
   */

  Function: function Function(node, parent, scope, state) {
    // skip over functions as whatever `arguments` we reference inside will refer
    // to the wrong function
    var oldNoOptimise = state.noOptimise;
    state.noOptimise = true;
    this.traverse(memberExpressionOptimisationVisitor, state);
    state.noOptimise = oldNoOptimise;
    this.skip();
  },

  /**
   * [Please add a description.]
   */

  ReferencedIdentifier: function ReferencedIdentifier(node, parent, scope, state) {
    // we can't guarantee the purity of arguments
    if (node.name === "arguments") {
      state.deopted = true;
    }

    // is this a referenced identifier and is it referencing the rest parameter?
    if (node.name !== state.name) return;

    if (state.noOptimise) {
      state.deopted = true;
    } else {
      if (this.parentPath.isMemberExpression({ computed: true, object: node })) {
        // if we know that this member expression is referencing a number then we can safely
        // optimise it
        var prop = this.parentPath.get("property");
        if (prop.isBaseType("number")) {
          state.candidates.push(this);
          return;
        }
      }

      // optimise single spread args in calls
      if (this.parentPath.isSpreadElement() && state.offset === 0) {
        var call = this.parentPath.parentPath;
        if (call.isCallExpression() && call.node.arguments.length === 1) {
          state.candidates.push(this);
          return;
        }
      }

      state.references.push(this);
    }
  },

  /**
   * Deopt on use of a binding identifier with the same name as our rest param.
   *
   * See https://github.com/babel/babel/issues/2091
   */

  BindingIdentifier: function BindingIdentifier(node, parent, scope, state) {
    if (node.name === state.name) {
      state.deopted = true;
    }
  }
};

/**
 * [Please add a description.]
 */

function optimiseMemberExpression(parent, offset) {
  if (offset === 0) return;

  var newExpr;
  var prop = parent.property;

  if (t.isLiteral(prop)) {
    prop.value += offset;
    prop.raw = String(prop.value);
  } else {
    // // UnaryExpression, BinaryExpression
    newExpr = t.binaryExpression("+", prop, t.literal(offset));
    parent.property = newExpr;
  }
}

/**
 * [Please add a description.]
 */

function hasRest(node) {
  return t.isRestElement(node.params[node.params.length - 1]);
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Function: function Function(node, parent, scope) {
    if (!hasRest(node)) return;

    var restParam = node.params.pop();
    var rest = restParam.argument;

    var argsId = t.identifier("arguments");

    // otherwise `arguments` will be remapped in arrow functions
    argsId._shadowedFunctionLiteral = this;

    // support patterns
    if (t.isPattern(rest)) {
      var pattern = rest;
      rest = scope.generateUidIdentifier("ref");

      var declar = t.variableDeclaration("let", pattern.elements.map(function (elem, index) {
        var accessExpr = t.memberExpression(rest, t.literal(index), true);
        return t.variableDeclarator(elem, accessExpr);
      }));
      node.body.body.unshift(declar);
    }

    // check and optimise for extremely common cases
    var state = {
      references: [],
      offset: node.params.length,

      argumentsNode: argsId,
      outerBinding: scope.getBindingIdentifier(rest.name),

      // candidate member expressions we could optimise if there are no other references
      candidates: [],

      // local rest binding name
      name: rest.name,

      // whether any references to the rest parameter were made in a function
      deopted: false
    };

    this.traverse(memberExpressionOptimisationVisitor, state);

    if (!state.deopted && !state.references.length) {
      // we only have shorthands and there are no other references
      if (state.candidates.length) {
        var _arr = state.candidates;

        for (var _i = 0; _i < _arr.length; _i++) {
          var candidate = _arr[_i];
          candidate.replaceWith(argsId);
          if (candidate.parentPath.isMemberExpression()) {
            optimiseMemberExpression(candidate.parent, state.offset);
          }
        }
      }
      return;
    } else {
      state.references = state.references.concat(state.candidates);
    }

    // deopt shadowed functions as transforms like regenerator may try touch the allocation loop
    state.deopted = state.deopted || !!node.shadow;

    //

    var start = t.literal(node.params.length);
    var key = scope.generateUidIdentifier("key");
    var len = scope.generateUidIdentifier("len");

    var arrKey = key;
    var arrLen = len;
    if (node.params.length) {
      // this method has additional params, so we need to subtract
      // the index of the current argument position from the
      // position in the array that we want to populate
      arrKey = t.binaryExpression("-", key, start);

      // we need to work out the size of the array that we're
      // going to store all the rest parameters
      //
      // we need to add a check to avoid constructing the array
      // with <0 if there are less arguments than params as it'll
      // cause an error
      arrLen = t.conditionalExpression(t.binaryExpression(">", len, start), t.binaryExpression("-", len, start), t.literal(0));
    }

    var loop = util.template("rest", {
      ARRAY_TYPE: restParam.typeAnnotation,
      ARGUMENTS: argsId,
      ARRAY_KEY: arrKey,
      ARRAY_LEN: arrLen,
      START: start,
      ARRAY: rest,
      KEY: key,
      LEN: len
    });

    if (state.deopted) {
      loop._blockHoist = node.params.length + 1;
      node.body.body.unshift(loop);
    } else {
      // perform allocation at the lowest common denominator of all references
      loop._blockHoist = 1;

      var target = this.getEarliestCommonAncestorFrom(state.references).getStatementParent();

      // don't perform the allocation inside a loop
      var highestLoop;
      target.findParent(function (path) {
        if (path.isLoop()) {
          highestLoop = path;
        } else if (path.isFunction()) {
          // stop crawling up for functions
          return true;
        }
      });
      if (highestLoop) target = highestLoop;

      target.insertBefore(loop);
    }
  }
};
exports.visitor = visitor;