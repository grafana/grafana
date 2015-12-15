/* */ 
'use strict';
var application_ref_1 = require('../../../core/application_ref');
var lang_1 = require('../../../facade/lang');
var browser_1 = require('../../../facade/browser');
var dom_adapter_1 = require('../../dom/dom_adapter');
var AngularTools = (function() {
  function AngularTools(ref) {
    this.profiler = new AngularProfiler(ref);
  }
  return AngularTools;
})();
exports.AngularTools = AngularTools;
var AngularProfiler = (function() {
  function AngularProfiler(ref) {
    this.appRef = ref.injector.get(application_ref_1.ApplicationRef);
  }
  AngularProfiler.prototype.timeChangeDetection = function(config) {
    var record = lang_1.isPresent(config) && config['record'];
    var profileName = 'Change Detection';
    var isProfilerAvailable = lang_1.isPresent(browser_1.window.console.profile);
    if (record && isProfilerAvailable) {
      browser_1.window.console.profile(profileName);
    }
    var start = dom_adapter_1.DOM.performanceNow();
    var numTicks = 0;
    while (numTicks < 5 || (dom_adapter_1.DOM.performanceNow() - start) < 500) {
      this.appRef.tick();
      numTicks++;
    }
    var end = dom_adapter_1.DOM.performanceNow();
    if (record && isProfilerAvailable) {
      browser_1.window.console.profileEnd(profileName);
    }
    var msPerTick = (end - start) / numTicks;
    browser_1.window.console.log("ran " + numTicks + " change detection cycles");
    browser_1.window.console.log(lang_1.NumberWrapper.toFixed(msPerTick, 2) + " ms per check");
  };
  return AngularProfiler;
})();
exports.AngularProfiler = AngularProfiler;
