/* */ 
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var jasminePatch = require('../jasmine/patch');

jasminePatch.apply();

},{"../jasmine/patch":2}],2:[function(require,module,exports){
(function (global){
'use strict';
// Patch jasmine's it and fit functions so that the `done` callback always resets the zone
// to the jasmine zone, which should be the root zone. (angular/zone.js#91)

function apply() {
  if (!global.zone) {
    throw new Error('zone.js does not seem to be installed');
  }

  if (!global.zone.isRootZone()) {
    throw new Error('The jasmine patch should be called from the root zone');
  }

  var jasmineZone = global.zone;
  var originalIt = global.it;
  var originalFit = global.fit;

  // Patch jasmine `done()`  and `done.fail()` so that they execute in the root zone
  var patchJasmineDone = function(jasmineDone) {
    var done = jasmineZone.bind(jasmineDone);
    if (typeof jasmineDone.fail === 'function') {
      done.fail = jasmineZone.bind(jasmineDone.fail);
    }

    return done;
  }

  global.it = function zoneResettingIt(description, specFn, timeOut) {
    if (specFn.length) {
      originalIt(description, function zoneResettingSpecFn(done) {
        specFn(patchJasmineDone(done));
      }, timeOut);
    } else {
      originalIt(description, specFn, timeOut);
    }
  };

  global.fit = function zoneResettingFit(description, specFn, timeOut) {
    if (specFn.length) {
      originalFit(description, function zoneResettingSpecFn(done) {
        specFn(patchJasmineDone(done));
      }, timeOut);
    } else {
      originalFit(description, specFn, timeOut);
    }
  };

  // global beforeEach to check if we always start from the root zone
  beforeEach(function() {
    expect(global.zone.isRootZone()).toBe(true);
  });
}

if (global.jasmine) {
  module.exports = {
    apply: apply
  };
} else {
  module.exports = {
    apply: function() { }
  };
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1]);
