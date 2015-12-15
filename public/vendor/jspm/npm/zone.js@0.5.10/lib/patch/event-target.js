/* */ 
'use strict';
var utils = require('../utils');
function apply() {
  if (global.EventTarget) {
    utils.patchEventTargetMethods(global.EventTarget.prototype);
  } else {
    var apis = ['ApplicationCache', 'EventSource', 'FileReader', 'InputMethodContext', 'MediaController', 'MessagePort', 'Node', 'Performance', 'SVGElementInstance', 'SharedWorker', 'TextTrack', 'TextTrackCue', 'TextTrackList', 'WebKitNamedFlow', 'Worker', 'WorkerGlobalScope', 'XMLHttpRequest', 'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload'];
    apis.forEach(function(api) {
      var proto = global[api] && global[api].prototype;
      if (proto && proto.addEventListener) {
        utils.patchEventTargetMethods(proto);
      }
    });
    if (typeof(window) !== 'undefined') {
      utils.patchEventTargetMethods(window);
    }
  }
}
module.exports = {apply: apply};
