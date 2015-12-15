/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports["default"] = {
  //- builtin-prepass
  "minification.constantFolding": require("babel-plugin-constant-folding"),

  //- builtin-pre
  strict: require("./other/strict"),
  eval: require("babel-plugin-eval"),
  _validation: require("./internal/validation"),
  _hoistDirectives: require("./internal/hoist-directives"),
  "minification.removeDebugger": require("babel-plugin-remove-debugger"),
  "minification.removeConsole": require("babel-plugin-remove-console"),
  "utility.inlineEnvironmentVariables": require("babel-plugin-inline-environment-variables"),
  "minification.deadCodeElimination": require("babel-plugin-dead-code-elimination"),
  _modules: require("./internal/modules"),
  "react.displayName": require("babel-plugin-react-display-name"),
  "es6.spec.modules": require("./es6/spec.modules"),
  "es6.spec.arrowFunctions": require("./es6/spec.arrow-functions"),
  "es6.spec.templateLiterals": require("./es6/spec.template-literals"),
  "es6.templateLiterals": require("./es6/template-literals"),
  "es6.literals": require("./es6/literals"),
  "validation.undeclaredVariableCheck": require("babel-plugin-undeclared-variables-check"),

  //- builtin-basic
  // this is where the bulk of the ES6 transformations take place, none of them require traversal state
  // so they can all be concatenated together for performance
  "spec.functionName": require("./spec/function-name"),
  "es7.classProperties": require("./es7/class-properties"),
  "es7.trailingFunctionCommas": require("./es7/trailing-function-commas"),
  "es7.asyncFunctions": require("./es7/async-functions"),
  "es7.decorators": require("./es7/decorators"),
  "validation.react": require("./validation/react"),
  "es6.arrowFunctions": require("./es6/arrow-functions"),
  "spec.blockScopedFunctions": require("./spec/block-scoped-functions"),
  "optimisation.react.constantElements": require("babel-plugin-react-constant-elements"),
  "optimisation.react.inlineElements": require("./optimisation/react.inline-elements"),
  "es7.comprehensions": require("./es7/comprehensions"),
  "es6.classes": require("./es6/classes"),
  asyncToGenerator: require("./other/async-to-generator"),
  bluebirdCoroutines: require("./other/bluebird-coroutines"),
  "es6.objectSuper": require("./es6/object-super"),
  "es7.objectRestSpread": require("./es7/object-rest-spread"),
  "es7.exponentiationOperator": require("./es7/exponentiation-operator"),
  "es5.properties.mutators": require("./es5/properties.mutators"),
  "es6.properties.shorthand": require("./es6/properties.shorthand"),
  "es6.properties.computed": require("./es6/properties.computed"),
  "optimisation.flow.forOf": require("./optimisation/flow.for-of"),
  "es6.forOf": require("./es6/for-of"),
  "es6.regex.sticky": require("./es6/regex.sticky"),
  "es6.regex.unicode": require("./es6/regex.unicode"),
  "es6.constants": require("./es6/constants"),
  "es7.exportExtensions": require("./es7/export-extensions"),
  "spec.protoToAssign": require("babel-plugin-proto-to-assign"),
  "es7.doExpressions": require("./es7/do-expressions"),
  "es6.spec.symbols": require("./es6/spec.symbols"),
  "es7.functionBind": require("./es7/function-bind"),
  "spec.undefinedToVoid": require("babel-plugin-undefined-to-void"),

  //- builtin-advanced
  "es6.spread": require("./es6/spread"),
  "es6.parameters": require("./es6/parameters"),
  "es6.destructuring": require("./es6/destructuring"),
  "es6.blockScoping": require("./es6/block-scoping"),
  "es6.spec.blockScoping": require("./es6/spec.block-scoping"),
  reactCompat: require("./other/react-compat"),
  react: require("./other/react"),
  regenerator: require("./other/regenerator"),

  // es6 syntax transformation is **forbidden** past this point since regenerator will chuck a massive
  // hissy fit

  //- builtin-modules
  runtime: require("babel-plugin-runtime"),
  "es6.modules": require("./es6/modules"),
  _moduleFormatter: require("./internal/module-formatter"),

  //- builtin-trailing
  // these clean up the output and do finishing up transformations, it's important to note that by this
  // stage you can't import any new modules or insert new ES6 as all those transformers have already
  // been ran
  "es6.tailCall": require("./es6/tail-call"),
  _shadowFunctions: require("./internal/shadow-functions"),
  "es3.propertyLiterals": require("./es3/property-literals"),
  "es3.memberExpressionLiterals": require("./es3/member-expression-literals"),
  "minification.memberExpressionLiterals": require("babel-plugin-member-expression-literals"),
  "minification.propertyLiterals": require("babel-plugin-property-literals"),
  _blockHoist: require("./internal/block-hoist"),
  jscript: require("babel-plugin-jscript"),
  flow: require("./other/flow"),
  "optimisation.modules.system": require("./optimisation/modules.system")
};
module.exports = exports["default"];