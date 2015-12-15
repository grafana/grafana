/* */ 
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
