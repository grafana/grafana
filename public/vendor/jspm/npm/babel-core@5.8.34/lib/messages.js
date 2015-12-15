/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.get = get;
exports.parseArgs = parseArgs;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _util = require("util");

var util = _interopRequireWildcard(_util);

/**
 * Mapping of messages to be used in Babel.
 * Messages can include $0-style placeholders.
 */

var MESSAGES = {
  tailCallReassignmentDeopt: "Function reference has been reassigned, so it will probably be dereferenced, therefore we can't optimise this with confidence",
  JSXNamespacedTags: "Namespace tags are not supported. ReactJSX is not XML.",
  classesIllegalBareSuper: "Illegal use of bare super",
  classesIllegalSuperCall: "Direct super call is illegal in non-constructor, use super.$1() instead",
  scopeDuplicateDeclaration: "Duplicate declaration $1",
  settersNoRest: "Setters aren't allowed to have a rest",
  noAssignmentsInForHead: "No assignments allowed in for-in/of head",
  expectedMemberExpressionOrIdentifier: "Expected type MemberExpression or Identifier",
  invalidParentForThisNode: "We don't know how to handle this node within the current parent - please open an issue",
  readOnly: "$1 is read-only",
  unknownForHead: "Unknown node type $1 in ForStatement",
  didYouMean: "Did you mean $1?",
  codeGeneratorDeopt: "Note: The code generator has deoptimised the styling of $1 as it exceeds the max of $2.",
  missingTemplatesDirectory: "no templates directory - this is most likely the result of a broken `npm publish`. Please report to https://github.com/babel/babel/issues",
  unsupportedOutputType: "Unsupported output type $1",
  illegalMethodName: "Illegal method name $1",
  lostTrackNodePath: "We lost track of this node's position, likely because the AST was directly manipulated",

  modulesIllegalExportName: "Illegal export $1",
  modulesDuplicateDeclarations: "Duplicate module declarations with the same source but in different scopes",

  undeclaredVariable: "Reference to undeclared variable $1",
  undeclaredVariableType: "Referencing a type alias outside of a type annotation",
  undeclaredVariableSuggestion: "Reference to undeclared variable $1 - did you mean $2?",

  traverseNeedsParent: "You must pass a scope and parentPath unless traversing a Program/File got a $1 node",
  traverseVerifyRootFunction: "You passed `traverse()` a function when it expected a visitor object, are you sure you didn't mean `{ enter: Function }`?",
  traverseVerifyVisitorProperty: "You passed `traverse()` a visitor object with the property $1 that has the invalid property $2",
  traverseVerifyNodeType: "You gave us a visitor for the node type $1 but it's not a valid type",

  pluginIllegalKind: "Illegal kind $1 for plugin $2",
  pluginIllegalPosition: "Illegal position $1 for plugin $2",
  pluginKeyCollision: "The plugin $1 collides with another of the same name",
  pluginNotTransformer: "The plugin $1 didn't export a Plugin instance",
  pluginUnknown: "Unknown plugin $1",

  pluginNotFile: "Plugin $1 is resolving to a different Babel version than what is performing the transformation.",

  pluginInvalidProperty: "Plugin $1 provided an invalid property of $2.",
  pluginInvalidPropertyVisitor: "Define your visitor methods inside a `visitor` property like so:\n\n  new Plugin(\"foobar\", {\n    visitor: {\n      // define your visitor methods here!\n    }\n  });\n"
};

exports.MESSAGES = MESSAGES;
/**
 * Get a message with $0 placeholders replaced by arguments.
 */

function get(key) {
  for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  var msg = MESSAGES[key];
  if (!msg) throw new ReferenceError("Unknown message " + JSON.stringify(key));

  // stringify args
  args = parseArgs(args);

  // replace $0 placeholders with args
  return msg.replace(/\$(\d+)/g, function (str, i) {
    return args[--i];
  });
}

/**
 * Stingify arguments to be used inside messages.
 */

function parseArgs(args) {
  return args.map(function (val) {
    if (val != null && val.inspect) {
      return val.inspect();
    } else {
      try {
        return JSON.stringify(val) || val + "";
      } catch (e) {
        return util.inspect(val);
      }
    }
  });
}