/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _messages = require("../../../messages");

var messages = _interopRequireWildcard(_messages);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  group: "builtin-advanced"
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ForXStatement: function ForXStatement(node, parent, scope, file) {
    var left = node.left;

    if (t.isPattern(left)) {
      // for ({ length: k } in { abc: 3 });

      var temp = scope.generateUidIdentifier("ref");

      node.left = t.variableDeclaration("var", [t.variableDeclarator(temp)]);

      this.ensureBlock();

      node.body.body.unshift(t.variableDeclaration("var", [t.variableDeclarator(left, temp)]));

      return;
    }

    if (!t.isVariableDeclaration(left)) return;

    var pattern = left.declarations[0].id;
    if (!t.isPattern(pattern)) return;

    var key = scope.generateUidIdentifier("ref");
    node.left = t.variableDeclaration(left.kind, [t.variableDeclarator(key, null)]);

    var nodes = [];

    var destructuring = new DestructuringTransformer({
      kind: left.kind,
      file: file,
      scope: scope,
      nodes: nodes
    });

    destructuring.init(pattern, key);

    this.ensureBlock();

    var block = node.body;
    block.body = nodes.concat(block.body);
  },

  /**
   * [Please add a description.]
   */

  Function: function Function(node, parent, scope, file) {
    var hasDestructuring = false;
    var _arr = node.params;
    for (var _i = 0; _i < _arr.length; _i++) {
      var pattern = _arr[_i];
      if (t.isPattern(pattern)) {
        hasDestructuring = true;
        break;
      }
    }
    if (!hasDestructuring) return;

    var nodes = [];

    for (var i = 0; i < node.params.length; i++) {
      var pattern = node.params[i];
      if (!t.isPattern(pattern)) continue;

      var ref = scope.generateUidIdentifier("ref");
      if (t.isAssignmentPattern(pattern)) {
        var _pattern = pattern;
        pattern = pattern.left;
        _pattern.left = ref;
      } else {
        node.params[i] = ref;
      }

      t.inherits(ref, pattern);

      var destructuring = new DestructuringTransformer({
        blockHoist: node.params.length - i,
        nodes: nodes,
        scope: scope,
        file: file,
        kind: "let"
      });

      destructuring.init(pattern, ref);
    }

    this.ensureBlock();

    var block = node.body;
    block.body = nodes.concat(block.body);
  },

  /**
   * [Please add a description.]
   */

  CatchClause: function CatchClause(node, parent, scope, file) {
    var pattern = node.param;
    if (!t.isPattern(pattern)) return;

    var ref = scope.generateUidIdentifier("ref");
    node.param = ref;

    var nodes = [];

    var destructuring = new DestructuringTransformer({
      kind: "let",
      file: file,
      scope: scope,
      nodes: nodes
    });
    destructuring.init(pattern, ref);

    node.body.body = nodes.concat(node.body.body);
  },

  /**
   * [Please add a description.]
   */

  AssignmentExpression: function AssignmentExpression(node, parent, scope, file) {
    if (!t.isPattern(node.left)) return;

    var nodes = [];

    var destructuring = new DestructuringTransformer({
      operator: node.operator,
      file: file,
      scope: scope,
      nodes: nodes
    });

    var ref;
    if (this.isCompletionRecord() || !this.parentPath.isExpressionStatement()) {
      ref = scope.generateUidIdentifierBasedOnNode(node.right, "ref");

      nodes.push(t.variableDeclaration("var", [t.variableDeclarator(ref, node.right)]));

      if (t.isArrayExpression(node.right)) {
        destructuring.arrays[ref.name] = true;
      }
    }

    destructuring.init(node.left, ref || node.right);

    if (ref) {
      nodes.push(t.expressionStatement(ref));
    }

    return nodes;
  },

  /**
   * [Please add a description.]
   */

  VariableDeclaration: function VariableDeclaration(node, parent, scope, file) {
    if (t.isForXStatement(parent)) return;
    if (!variableDeclarationHasPattern(node)) return;

    var nodes = [];
    var declar;

    for (var i = 0; i < node.declarations.length; i++) {
      declar = node.declarations[i];

      var patternId = declar.init;
      var pattern = declar.id;

      var destructuring = new DestructuringTransformer({
        nodes: nodes,
        scope: scope,
        kind: node.kind,
        file: file
      });

      if (t.isPattern(pattern)) {
        destructuring.init(pattern, patternId);

        if (+i !== node.declarations.length - 1) {
          // we aren't the last declarator so let's just make the
          // last transformed node inherit from us
          t.inherits(nodes[nodes.length - 1], declar);
        }
      } else {
        nodes.push(t.inherits(destructuring.buildVariableAssignment(declar.id, declar.init), declar));
      }
    }

    if (!t.isProgram(parent) && !t.isBlockStatement(parent)) {
      // https://github.com/babel/babel/issues/113
      // for (let [x] = [0]; false;) {}

      declar = null;

      for (i = 0; i < nodes.length; i++) {
        node = nodes[i];
        declar = declar || t.variableDeclaration(node.kind, []);

        if (!t.isVariableDeclaration(node) && declar.kind !== node.kind) {
          throw file.errorWithNode(node, messages.get("invalidParentForThisNode"));
        }

        declar.declarations = declar.declarations.concat(node.declarations);
      }

      return declar;
    }

    return nodes;
  }
};

exports.visitor = visitor;
/**
 * Test if a VariableDeclaration's declarations contains any Patterns.
 */

function variableDeclarationHasPattern(node) {
  for (var i = 0; i < node.declarations.length; i++) {
    if (t.isPattern(node.declarations[i].id)) {
      return true;
    }
  }
  return false;
}

/**
 * Test if an ArrayPattern's elements contain any RestElements.
 */

function hasRest(pattern) {
  for (var i = 0; i < pattern.elements.length; i++) {
    if (t.isRestElement(pattern.elements[i])) {
      return true;
    }
  }
  return false;
}

/**
 * [Please add a description.]
 */

var arrayUnpackVisitor = {

  /**
   * [Please add a description.]
   */

  ReferencedIdentifier: function ReferencedIdentifier(node, parent, scope, state) {
    if (state.bindings[node.name]) {
      state.deopt = true;
      this.stop();
    }
  }
};

/**
 * [Please add a description.]
 */

var DestructuringTransformer = (function () {
  function DestructuringTransformer(opts) {
    _classCallCheck(this, DestructuringTransformer);

    this.blockHoist = opts.blockHoist;
    this.operator = opts.operator;
    this.arrays = {};
    this.nodes = opts.nodes || [];
    this.scope = opts.scope;
    this.file = opts.file;
    this.kind = opts.kind;
  }

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.buildVariableAssignment = function buildVariableAssignment(id, init) {
    var op = this.operator;
    if (t.isMemberExpression(id)) op = "=";

    var node;

    if (op) {
      node = t.expressionStatement(t.assignmentExpression(op, id, init));
    } else {
      node = t.variableDeclaration(this.kind, [t.variableDeclarator(id, init)]);
    }

    node._blockHoist = this.blockHoist;

    return node;
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.buildVariableDeclaration = function buildVariableDeclaration(id, init) {
    var declar = t.variableDeclaration("var", [t.variableDeclarator(id, init)]);
    declar._blockHoist = this.blockHoist;
    return declar;
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.push = function push(id, init) {
    if (t.isObjectPattern(id)) {
      this.pushObjectPattern(id, init);
    } else if (t.isArrayPattern(id)) {
      this.pushArrayPattern(id, init);
    } else if (t.isAssignmentPattern(id)) {
      this.pushAssignmentPattern(id, init);
    } else {
      this.nodes.push(this.buildVariableAssignment(id, init));
    }
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.toArray = function toArray(node, count) {
    if (this.file.isLoose("es6.destructuring") || t.isIdentifier(node) && this.arrays[node.name]) {
      return node;
    } else {
      return this.scope.toArray(node, count);
    }
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.pushAssignmentPattern = function pushAssignmentPattern(pattern, valueRef) {
    // we need to assign the current value of the assignment to avoid evaluating
    // it more than once

    var tempValueRef = this.scope.generateUidIdentifierBasedOnNode(valueRef);

    var declar = t.variableDeclaration("var", [t.variableDeclarator(tempValueRef, valueRef)]);
    declar._blockHoist = this.blockHoist;
    this.nodes.push(declar);

    //

    var tempConditional = t.conditionalExpression(t.binaryExpression("===", tempValueRef, t.identifier("undefined")), pattern.right, tempValueRef);

    var left = pattern.left;
    if (t.isPattern(left)) {
      var tempValueDefault = t.expressionStatement(t.assignmentExpression("=", tempValueRef, tempConditional));
      tempValueDefault._blockHoist = this.blockHoist;

      this.nodes.push(tempValueDefault);
      this.push(left, tempValueRef);
    } else {
      this.nodes.push(this.buildVariableAssignment(left, tempConditional));
    }
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.pushObjectSpread = function pushObjectSpread(pattern, objRef, spreadProp, spreadPropIndex) {
    // get all the keys that appear in this object before the current spread

    var keys = [];

    for (var i = 0; i < pattern.properties.length; i++) {
      var prop = pattern.properties[i];

      // we've exceeded the index of the spread property to all properties to the
      // right need to be ignored
      if (i >= spreadPropIndex) break;

      // ignore other spread properties
      if (t.isSpreadProperty(prop)) continue;

      var key = prop.key;
      if (t.isIdentifier(key) && !prop.computed) key = t.literal(prop.key.name);
      keys.push(key);
    }

    keys = t.arrayExpression(keys);

    //

    var value = t.callExpression(this.file.addHelper("object-without-properties"), [objRef, keys]);
    this.nodes.push(this.buildVariableAssignment(spreadProp.argument, value));
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.pushObjectProperty = function pushObjectProperty(prop, propRef) {
    if (t.isLiteral(prop.key)) prop.computed = true;

    var pattern = prop.value;
    var objRef = t.memberExpression(propRef, prop.key, prop.computed);

    if (t.isPattern(pattern)) {
      this.push(pattern, objRef);
    } else {
      this.nodes.push(this.buildVariableAssignment(pattern, objRef));
    }
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.pushObjectPattern = function pushObjectPattern(pattern, objRef) {
    // https://github.com/babel/babel/issues/681

    if (!pattern.properties.length) {
      this.nodes.push(t.expressionStatement(t.callExpression(this.file.addHelper("object-destructuring-empty"), [objRef])));
    }

    // if we have more than one properties in this pattern and the objectRef is a
    // member expression then we need to assign it to a temporary variable so it's
    // only evaluated once

    if (pattern.properties.length > 1 && !this.scope.isStatic(objRef)) {
      var temp = this.scope.generateUidIdentifierBasedOnNode(objRef);
      this.nodes.push(this.buildVariableDeclaration(temp, objRef));
      objRef = temp;
    }

    //

    for (var i = 0; i < pattern.properties.length; i++) {
      var prop = pattern.properties[i];
      if (t.isSpreadProperty(prop)) {
        this.pushObjectSpread(pattern, objRef, prop, i);
      } else {
        this.pushObjectProperty(prop, objRef);
      }
    }
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.canUnpackArrayPattern = function canUnpackArrayPattern(pattern, arr) {
    // not an array so there's no way we can deal with this
    if (!t.isArrayExpression(arr)) return false;

    // pattern has less elements than the array and doesn't have a rest so some
    // elements wont be evaluated
    if (pattern.elements.length > arr.elements.length) return;
    if (pattern.elements.length < arr.elements.length && !hasRest(pattern)) return false;

    var _arr2 = pattern.elements;
    for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
      var elem = _arr2[_i2];
      // deopt on holes
      if (!elem) return false;

      // deopt on member expressions as they may be included in the RHS
      if (t.isMemberExpression(elem)) return false;
    }

    var _arr3 = arr.elements;
    for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
      var elem = _arr3[_i3];
      // deopt on spread elements
      if (t.isSpreadElement(elem)) return false;
    }

    // deopt on reference to left side identifiers
    var bindings = t.getBindingIdentifiers(pattern);
    var state = { deopt: false, bindings: bindings };
    this.scope.traverse(arr, arrayUnpackVisitor, state);
    return !state.deopt;
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.pushUnpackedArrayPattern = function pushUnpackedArrayPattern(pattern, arr) {
    for (var i = 0; i < pattern.elements.length; i++) {
      var elem = pattern.elements[i];
      if (t.isRestElement(elem)) {
        this.push(elem.argument, t.arrayExpression(arr.elements.slice(i)));
      } else {
        this.push(elem, arr.elements[i]);
      }
    }
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.pushArrayPattern = function pushArrayPattern(pattern, arrayRef) {
    if (!pattern.elements) return;

    // optimise basic array destructuring of an array expression
    //
    // we can't do this to a pattern of unequal size to it's right hand
    // array expression as then there will be values that wont be evaluated
    //
    // eg: var [a, b] = [1, 2];

    if (this.canUnpackArrayPattern(pattern, arrayRef)) {
      return this.pushUnpackedArrayPattern(pattern, arrayRef);
    }

    // if we have a rest then we need all the elements so don't tell
    // `scope.toArray` to only get a certain amount

    var count = !hasRest(pattern) && pattern.elements.length;

    // so we need to ensure that the `arrayRef` is an array, `scope.toArray` will
    // return a locally bound identifier if it's been inferred to be an array,
    // otherwise it'll be a call to a helper that will ensure it's one

    var toArray = this.toArray(arrayRef, count);

    if (t.isIdentifier(toArray)) {
      // we've been given an identifier so it must have been inferred to be an
      // array
      arrayRef = toArray;
    } else {
      arrayRef = this.scope.generateUidIdentifierBasedOnNode(arrayRef);
      this.arrays[arrayRef.name] = true;
      this.nodes.push(this.buildVariableDeclaration(arrayRef, toArray));
    }

    //

    for (var i = 0; i < pattern.elements.length; i++) {
      var elem = pattern.elements[i];

      // hole
      if (!elem) continue;

      var elemRef;

      if (t.isRestElement(elem)) {
        elemRef = this.toArray(arrayRef);

        if (i > 0) {
          elemRef = t.callExpression(t.memberExpression(elemRef, t.identifier("slice")), [t.literal(i)]);
        }

        // set the element to the rest element argument since we've dealt with it
        // being a rest already
        elem = elem.argument;
      } else {
        elemRef = t.memberExpression(arrayRef, t.literal(i), true);
      }

      this.push(elem, elemRef);
    }
  };

  /**
   * [Please add a description.]
   */

  DestructuringTransformer.prototype.init = function init(pattern, ref) {
    // trying to destructure a value that we can't evaluate more than once so we
    // need to save it to a variable

    if (!t.isArrayExpression(ref) && !t.isMemberExpression(ref)) {
      var memo = this.scope.maybeGenerateMemoised(ref, true);
      if (memo) {
        this.nodes.push(this.buildVariableDeclaration(memo, ref));
        ref = memo;
      }
    }

    //

    this.push(pattern, ref);

    return this.nodes;
  };

  return DestructuringTransformer;
})();