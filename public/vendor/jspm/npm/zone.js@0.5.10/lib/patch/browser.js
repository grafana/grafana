/* */ 
'use strict';
var fnPatch = require('./functions');
var promisePatch = require('./promise');
var mutationObserverPatch = require('./mutation-observer');
var definePropertyPatch = require('./define-property');
var registerElementPatch = require('./register-element');
var webSocketPatch = require('./websocket');
var eventTargetPatch = require('./event-target');
var propertyDescriptorPatch = require('./property-descriptor');
var geolocationPatch = require('./geolocation');
var fileReaderPatch = require('./file-reader');
function apply() {
  fnPatch.patchSetClearFunction(global, ['timeout', 'interval', 'immediate']);
  fnPatch.patchRequestAnimationFrame(global, ['requestAnimationFrame', 'mozRequestAnimationFrame', 'webkitRequestAnimationFrame']);
  fnPatch.patchFunction(global, ['alert', 'prompt']);
  eventTargetPatch.apply();
  propertyDescriptorPatch.apply();
  promisePatch.apply();
  mutationObserverPatch.patchClass('MutationObserver');
  mutationObserverPatch.patchClass('WebKitMutationObserver');
  definePropertyPatch.apply();
  registerElementPatch.apply();
  geolocationPatch.apply();
  fileReaderPatch.apply();
}
module.exports = {apply: apply};
