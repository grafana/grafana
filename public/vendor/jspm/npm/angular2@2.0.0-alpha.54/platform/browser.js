/* */ 
(function(process) {
  'use strict';
  var angular_entrypoint_1 = require('../src/core/angular_entrypoint');
  exports.AngularEntrypoint = angular_entrypoint_1.AngularEntrypoint;
  var browser_common_1 = require('../src/platform/browser_common');
  exports.BROWSER_PROVIDERS = browser_common_1.BROWSER_PROVIDERS;
  exports.ELEMENT_PROBE_BINDINGS = browser_common_1.ELEMENT_PROBE_BINDINGS;
  exports.ELEMENT_PROBE_PROVIDERS = browser_common_1.ELEMENT_PROBE_PROVIDERS;
  exports.inspectNativeElement = browser_common_1.inspectNativeElement;
  exports.BrowserDomAdapter = browser_common_1.BrowserDomAdapter;
  exports.By = browser_common_1.By;
  exports.Title = browser_common_1.Title;
  exports.DOCUMENT = browser_common_1.DOCUMENT;
  exports.enableDebugTools = browser_common_1.enableDebugTools;
  exports.disableDebugTools = browser_common_1.disableDebugTools;
  var lang_1 = require('../src/facade/lang');
  var browser_common_2 = require('../src/platform/browser_common');
  var compiler_1 = require('../compiler');
  var core_1 = require('../core');
  var reflection_capabilities_1 = require('../src/core/reflection/reflection_capabilities');
  var xhr_impl_1 = require('../src/platform/browser/xhr_impl');
  var compiler_2 = require('../compiler');
  var di_1 = require('../src/core/di');
  exports.BROWSER_APP_PROVIDERS = lang_1.CONST_EXPR([browser_common_2.BROWSER_APP_COMMON_PROVIDERS, compiler_1.COMPILER_PROVIDERS, new di_1.Provider(compiler_2.XHR, {useClass: xhr_impl_1.XHRImpl})]);
  function bootstrap(appComponentType, customProviders) {
    core_1.reflector.reflectionCapabilities = new reflection_capabilities_1.ReflectionCapabilities();
    var appProviders = lang_1.isPresent(customProviders) ? [exports.BROWSER_APP_PROVIDERS, customProviders] : exports.BROWSER_APP_PROVIDERS;
    return core_1.platform(browser_common_2.BROWSER_PROVIDERS).application(appProviders).bootstrap(appComponentType);
  }
  exports.bootstrap = bootstrap;
})(require('process'));
