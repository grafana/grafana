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

var _helpersMemoiseDecorators = require("../../../helpers/memoise-decorators");

var _helpersMemoiseDecorators2 = _interopRequireDefault(_helpersMemoiseDecorators);

var _helpersReplaceSupers = require("../../../helpers/replace-supers");

var _helpersReplaceSupers2 = _interopRequireDefault(_helpersReplaceSupers);

var _helpersNameMethod = require("../../../helpers/name-method");

var nameMethod = _interopRequireWildcard(_helpersNameMethod);

var _helpersDefineMap = require("../../../helpers/define-map");

var defineMap = _interopRequireWildcard(_helpersDefineMap);

var _messages = require("../../../../messages");

var messages = _interopRequireWildcard(_messages);

var _util = require("../../../../util");

var util = _interopRequireWildcard(_util);

var _types = require("../../../../types");

var t = _interopRequireWildcard(_types);

var PROPERTY_COLLISION_METHOD_NAME = "__initializeProperties";

/**
 * [Please add a description.]
 */

var collectPropertyReferencesVisitor = {

  /**
   * [Please add a description.]
   */

  Identifier: {
    enter: function enter(node, parent, scope, state) {
      if (this.parentPath.isClassProperty({ key: node })) {
        return;
      }

      if (this.isReferenced() && scope.getBinding(node.name) === state.scope.getBinding(node.name)) {
        state.references[node.name] = true;
      }
    }
  }
};

/**
 * [Please add a description.]
 */

var verifyConstructorVisitor = {

  /**
   * [Please add a description.]
   */

  MethodDefinition: function MethodDefinition() {
    this.skip();
  },

  /**
   * [Please add a description.]
   */

  Property: function Property(node) {
    if (node.method) this.skip();
  },

  /**
   * [Please add a description.]
   */

  CallExpression: {
    exit: function exit(node, parent, scope, state) {
      if (this.get("callee").isSuper()) {
        state.hasBareSuper = true;
        state.bareSuper = this;

        if (!state.isDerived) {
          throw this.errorWithNode("super call is only allowed in derived constructor");
        }
      }
    }
  },

  /**
   * [Please add a description.]
   */

  "FunctionDeclaration|FunctionExpression": function FunctionDeclarationFunctionExpression() {
    this.skip();
  },

  /**
   * [Please add a description.]
   */

  ThisExpression: function ThisExpression(node, parent, scope, state) {
    if (state.isDerived && !state.hasBareSuper) {
      if (this.inShadow()) {
        // https://github.com/babel/babel/issues/1920
        var thisAlias = state.constructorPath.getData("this");

        if (!thisAlias) {
          thisAlias = state.constructorPath.setData("this", state.constructorPath.scope.generateUidIdentifier("this"));
        }

        return thisAlias;
      } else {
        throw this.errorWithNode("'this' is not allowed before super()");
      }
    }
  },

  /**
   * [Please add a description.]
   */

  Super: function Super(node, parent, scope, state) {
    if (state.isDerived && !state.hasBareSuper && !this.parentPath.isCallExpression({ callee: node })) {
      throw this.errorWithNode("'super.*' is not allowed before super()");
    }
  }
};

/**
 * [Please add a description.]
 */

var ClassTransformer = (function () {
  function ClassTransformer(path, file) {
    _classCallCheck(this, ClassTransformer);

    this.parent = path.parent;
    this.scope = path.scope;
    this.node = path.node;
    this.path = path;
    this.file = file;

    this.clearDescriptors();

    this.instancePropBody = [];
    this.instancePropRefs = {};
    this.staticPropBody = [];
    this.body = [];

    this.pushedConstructor = false;
    this.pushedInherits = false;
    this.hasDecorators = false;
    this.isLoose = false;

    // class id
    this.classId = this.node.id;

    // this is the name of the binding that will **always** reference the class we've constructed
    this.classRef = this.node.id || this.scope.generateUidIdentifier("class");

    // this is a direct reference to the class we're building, class decorators can shadow the classRef
    this.directRef = null;

    this.superName = this.node.superClass || t.identifier("Function");
    this.isDerived = !!this.node.superClass;
  }

  /**
   * [Please add a description.]
   * @returns {Array}
   */

  ClassTransformer.prototype.run = function run() {
    var superName = this.superName;
    var file = this.file;

    //

    var body = this.body;

    //

    var constructorBody = this.constructorBody = t.blockStatement([]);
    this.constructor = this.buildConstructor();

    //

    var closureParams = [];
    var closureArgs = [];

    //
    if (this.isDerived) {
      closureArgs.push(superName);

      superName = this.scope.generateUidIdentifierBasedOnNode(superName);
      closureParams.push(superName);

      this.superName = superName;
    }

    //
    var decorators = this.node.decorators;
    if (decorators) {
      // this is so super calls and the decorators have access to the raw function
      this.directRef = this.scope.generateUidIdentifier(this.classRef);
    } else {
      this.directRef = this.classRef;
    }

    //
    this.buildBody();

    // make sure this class isn't directly called
    constructorBody.body.unshift(t.expressionStatement(t.callExpression(file.addHelper("class-call-check"), [t.thisExpression(), this.directRef])));

    //
    this.pushDecorators();

    body = body.concat(this.staticPropBody);

    if (this.classId) {
      // named class with only a constructor
      if (body.length === 1) return t.toExpression(body[0]);
    }

    //
    body.push(t.returnStatement(this.classRef));

    var container = t.functionExpression(null, closureParams, t.blockStatement(body));
    container.shadow = true;
    return t.callExpression(container, closureArgs);
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.buildConstructor = function buildConstructor() {
    var func = t.functionDeclaration(this.classRef, [], this.constructorBody);
    t.inherits(func, this.node);
    return func;
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.pushToMap = function pushToMap(node, enumerable) {
    var kind = arguments.length <= 2 || arguments[2] === undefined ? "value" : arguments[2];

    var mutatorMap;
    if (node["static"]) {
      this.hasStaticDescriptors = true;
      mutatorMap = this.staticMutatorMap;
    } else {
      this.hasInstanceDescriptors = true;
      mutatorMap = this.instanceMutatorMap;
    }

    var map = defineMap.push(mutatorMap, node, kind, this.file);

    if (enumerable) {
      map.enumerable = t.literal(true);
    }

    if (map.decorators) {
      this.hasDecorators = true;
    }
  };

  /**
   * [Please add a description.]
   * https://www.youtube.com/watch?v=fWNaR-rxAic
   */

  ClassTransformer.prototype.constructorMeMaybe = function constructorMeMaybe() {
    var hasConstructor = false;
    var paths = this.path.get("body.body");
    var _arr = paths;
    for (var _i = 0; _i < _arr.length; _i++) {
      var path = _arr[_i];
      hasConstructor = path.equals("kind", "constructor");
      if (hasConstructor) break;
    }
    if (hasConstructor) return;

    var constructor;
    if (this.isDerived) {
      constructor = util.template("class-derived-default-constructor");
    } else {
      constructor = t.functionExpression(null, [], t.blockStatement([]));
    }

    this.path.get("body").unshiftContainer("body", t.methodDefinition(t.identifier("constructor"), constructor, "constructor"));
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.buildBody = function buildBody() {
    this.constructorMeMaybe();
    this.pushBody();
    this.placePropertyInitializers();

    if (this.userConstructor) {
      var constructorBody = this.constructorBody;
      constructorBody.body = constructorBody.body.concat(this.userConstructor.body.body);
      t.inherits(this.constructor, this.userConstructor);
      t.inherits(constructorBody, this.userConstructor.body);
    }

    this.pushDescriptors();
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.pushBody = function pushBody() {
    var classBodyPaths = this.path.get("body.body");

    var _arr2 = classBodyPaths;
    for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
      var path = _arr2[_i2];
      var node = path.node;

      if (node.decorators) {
        _helpersMemoiseDecorators2["default"](node.decorators, this.scope);
      }

      if (t.isMethodDefinition(node)) {
        var isConstructor = node.kind === "constructor";
        if (isConstructor) this.verifyConstructor(path);

        var replaceSupers = new _helpersReplaceSupers2["default"]({
          methodPath: path,
          methodNode: node,
          objectRef: this.directRef,
          superRef: this.superName,
          isStatic: node["static"],
          isLoose: this.isLoose,
          scope: this.scope,
          file: this.file
        }, true);

        replaceSupers.replace();

        if (isConstructor) {
          this.pushConstructor(node, path);
        } else {
          this.pushMethod(node, path);
        }
      } else if (t.isClassProperty(node)) {
        this.pushProperty(node, path);
      }
    }
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.clearDescriptors = function clearDescriptors() {
    this.hasInstanceDescriptors = false;
    this.hasStaticDescriptors = false;

    this.instanceMutatorMap = {};
    this.staticMutatorMap = {};
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.pushDescriptors = function pushDescriptors() {
    this.pushInherits();

    var body = this.body;

    var instanceProps;
    var staticProps;
    var classHelper = "create-class";
    if (this.hasDecorators) classHelper = "create-decorated-class";

    if (this.hasInstanceDescriptors) {
      instanceProps = defineMap.toClassObject(this.instanceMutatorMap);
    }

    if (this.hasStaticDescriptors) {
      staticProps = defineMap.toClassObject(this.staticMutatorMap);
    }

    if (instanceProps || staticProps) {
      if (instanceProps) instanceProps = defineMap.toComputedObjectFromClass(instanceProps);
      if (staticProps) staticProps = defineMap.toComputedObjectFromClass(staticProps);

      var nullNode = t.literal(null);

      // (Constructor, instanceDescriptors, staticDescriptors, instanceInitializers, staticInitializers)
      var args = [this.classRef, nullNode, nullNode, nullNode, nullNode];

      if (instanceProps) args[1] = instanceProps;
      if (staticProps) args[2] = staticProps;

      if (this.instanceInitializersId) {
        args[3] = this.instanceInitializersId;
        body.unshift(this.buildObjectAssignment(this.instanceInitializersId));
      }

      if (this.staticInitializersId) {
        args[4] = this.staticInitializersId;
        body.unshift(this.buildObjectAssignment(this.staticInitializersId));
      }

      var lastNonNullIndex = 0;
      for (var i = 0; i < args.length; i++) {
        if (args[i] !== nullNode) lastNonNullIndex = i;
      }
      args = args.slice(0, lastNonNullIndex + 1);

      body.push(t.expressionStatement(t.callExpression(this.file.addHelper(classHelper), args)));
    }

    this.clearDescriptors();
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.buildObjectAssignment = function buildObjectAssignment(id) {
    return t.variableDeclaration("var", [t.variableDeclarator(id, t.objectExpression([]))]);
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.placePropertyInitializers = function placePropertyInitializers() {
    var body = this.instancePropBody;
    if (!body.length) return;

    if (this.hasPropertyCollision()) {
      var call = t.expressionStatement(t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(PROPERTY_COLLISION_METHOD_NAME)), []));

      this.pushMethod(t.methodDefinition(t.identifier(PROPERTY_COLLISION_METHOD_NAME), t.functionExpression(null, [], t.blockStatement(body))), null, true);

      if (this.isDerived) {
        this.bareSuper.insertAfter(call);
      } else {
        this.constructorBody.body.unshift(call);
      }
    } else {
      if (this.isDerived) {
        this.bareSuper.insertAfter(body);
      } else {
        this.constructorBody.body = body.concat(this.constructorBody.body);
      }
    }
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.hasPropertyCollision = function hasPropertyCollision() {
    if (this.userConstructorPath) {
      for (var name in this.instancePropRefs) {
        if (this.userConstructorPath.scope.hasOwnBinding(name)) {
          return true;
        }
      }
    }

    return false;
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.verifyConstructor = function verifyConstructor(path) {
    var state = {
      constructorPath: path.get("value"),
      hasBareSuper: false,
      bareSuper: null,
      isDerived: this.isDerived,
      file: this.file
    };

    state.constructorPath.traverse(verifyConstructorVisitor, state);

    var thisAlias = state.constructorPath.getData("this");
    if (thisAlias && state.bareSuper) {
      state.bareSuper.insertAfter(t.variableDeclaration("var", [t.variableDeclarator(thisAlias, t.thisExpression())]));
    }

    this.bareSuper = state.bareSuper;

    if (!state.hasBareSuper && this.isDerived) {
      throw path.errorWithNode("Derived constructor must call super()");
    }
  };

  /**
   * Push a method to its respective mutatorMap.
   */

  ClassTransformer.prototype.pushMethod = function pushMethod(node, path, allowedIllegal) {
    if (!allowedIllegal && t.isLiteral(t.toComputedKey(node), { value: PROPERTY_COLLISION_METHOD_NAME })) {
      throw this.file.errorWithNode(node, messages.get("illegalMethodName", PROPERTY_COLLISION_METHOD_NAME));
    }

    if (node.kind === "method") {
      nameMethod.property(node, this.file, path ? path.get("value").scope : this.scope);
      if (this._processMethod(node)) return;
    }

    this.pushToMap(node);
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype._processMethod = function _processMethod() {
    return false;
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype.pushProperty = function pushProperty(node, path) {
    path.traverse(collectPropertyReferencesVisitor, {
      references: this.instancePropRefs,
      scope: this.scope
    });

    if (node.decorators) {
      var body = [];
      if (node.value) {
        body.push(t.returnStatement(node.value));
        node.value = t.functionExpression(null, [], t.blockStatement(body));
      } else {
        node.value = t.literal(null);
      }
      this.pushToMap(node, true, "initializer");

      var initializers;
      var target;
      if (node["static"]) {
        initializers = this.staticInitializersId = this.staticInitializersId || this.scope.generateUidIdentifier("staticInitializers");
        body = this.staticPropBody;
        target = this.classRef;
      } else {
        initializers = this.instanceInitializersId = this.instanceInitializersId || this.scope.generateUidIdentifier("instanceInitializers");
        body = this.instancePropBody;
        target = t.thisExpression();
      }

      body.push(t.expressionStatement(t.callExpression(this.file.addHelper("define-decorated-property-descriptor"), [target, t.literal(node.key.name), initializers])));
    } else {
      if (!node.value && !node.decorators) return;

      if (node["static"]) {
        // can just be added to the static map
        this.pushToMap(node, true);
      } else if (node.value) {
        // add this to the instancePropBody which will be added after the super call in a derived constructor
        // or at the start of a constructor for a non-derived constructor
        this.instancePropBody.push(t.expressionStatement(t.assignmentExpression("=", t.memberExpression(t.thisExpression(), node.key), node.value)));
      }
    }
  };

  /**
   * Replace the constructor body of our class.
   */

  ClassTransformer.prototype.pushConstructor = function pushConstructor(method, path) {
    // https://github.com/babel/babel/issues/1077
    var fnPath = path.get("value");
    if (fnPath.scope.hasOwnBinding(this.classRef.name)) {
      fnPath.scope.rename(this.classRef.name);
    }

    var construct = this.constructor;
    var fn = method.value;

    this.userConstructorPath = fnPath;
    this.userConstructor = fn;
    this.hasConstructor = true;

    t.inheritsComments(construct, method);

    construct._ignoreUserWhitespace = true;
    construct.params = fn.params;

    t.inherits(construct.body, fn.body);

    // push constructor to body
    this._pushConstructor();
  };

  /**
   * [Please add a description.]
   */

  ClassTransformer.prototype._pushConstructor = function _pushConstructor() {
    if (this.pushedConstructor) return;
    this.pushedConstructor = true;

    // we haven't pushed any descriptors yet
    if (this.hasInstanceDescriptors || this.hasStaticDescriptors) {
      this.pushDescriptors();
    }

    this.body.push(this.constructor);

    this.pushInherits();
  };

  /**
   * Push inherits helper to body.
   */

  ClassTransformer.prototype.pushInherits = function pushInherits() {
    if (!this.isDerived || this.pushedInherits) return;

    // Unshift to ensure that the constructor inheritance is set up before
    // any properties can be assigned to the prototype.
    this.pushedInherits = true;
    this.body.unshift(t.expressionStatement(t.callExpression(this.file.addHelper("inherits"), [this.classRef, this.superName])));
  };

  /**
   * Push decorators to body.
   */

  ClassTransformer.prototype.pushDecorators = function pushDecorators() {
    var decorators = this.node.decorators;
    if (!decorators) return;

    this.body.push(t.variableDeclaration("var", [t.variableDeclarator(this.directRef, this.classRef)]));

    // reverse the decorators so we execute them in the right order
    decorators = decorators.reverse();

    var _arr3 = decorators;
    for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
      var decorator = _arr3[_i3];
      var decoratorNode = util.template("class-decorator", {
        DECORATOR: decorator.expression,
        CLASS_REF: this.classRef
      }, true);
      decoratorNode.expression._ignoreModulesRemap = true;
      this.body.push(decoratorNode);
    }
  };

  return ClassTransformer;
})();

exports["default"] = ClassTransformer;
module.exports = exports["default"];