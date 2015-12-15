/* */ 
'use strict';
var core = require('../core');
var microtask = require('../microtask');
var browserPatch = require('../patch/browser');
var es6Promise = require('es6-promise');
if (global.Zone) {
  console.warn('Zone already exported on window the object!');
}
global.Zone = microtask.addMicrotaskSupport(core.Zone);
global.zone = new global.Zone();
global.Promise = es6Promise.Promise;
browserPatch.apply();
