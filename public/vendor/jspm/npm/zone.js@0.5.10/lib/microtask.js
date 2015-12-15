/* */ 
'use strict';

// TODO(vicb): Create a benchmark for the different methods & the usage of the queue
// see https://github.com/angular/zone.js/issues/97

// It is required to initialize hasNativePromise before requiring es6-promise otherwise es6-promise would
// overwrite the native Promise implementation on v8 and the check would always return false.
// see https://github.com/jakearchibald/es6-promise/issues/140
var hasNativePromise = typeof Promise !== "undefined" &&
    Promise.toString().indexOf("[native code]") !== -1;

var isFirefox = global.navigator &&
    global.navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

var resolvedPromise;

// TODO(vicb): remove '!isFirefox' when the bug gets fixed:
// https://bugzilla.mozilla.org/show_bug.cgi?id=1162013
if (hasNativePromise && !isFirefox) {
  // When available use a native Promise to schedule microtasks.
  // When not available, es6-promise fallback will be used
  resolvedPromise = Promise.resolve();
}

var es6Promise = require('es6-promise').Promise;

if (resolvedPromise) {
  es6Promise._setScheduler(function(fn) {
    resolvedPromise.then(fn);
  });
}

// es6-promise asap should schedule microtasks via zone.scheduleMicrotask so that any
// user defined hooks are triggered
es6Promise._setAsap(function(fn, arg) {
  global.zone.scheduleMicrotask(function() {
    fn(arg);
  });
});

// The default implementation of scheduleMicrotask use the original es6-promise implementation
// to schedule a microtask
function scheduleMicrotask(fn) {
  es6Promise._asap(this.bind(fn));
}

function addMicrotaskSupport(zoneClass) {
  zoneClass.prototype.scheduleMicrotask = scheduleMicrotask;
  return zoneClass;
}

module.exports = {
  addMicrotaskSupport: addMicrotaskSupport
};



