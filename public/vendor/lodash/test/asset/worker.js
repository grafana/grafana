'use strict';

self.console || (self.console = { 'log': function() {} });

addEventListener('message', function(e) {
  if (e.data) {
    try {
      importScripts('../' + e.data);
    } catch (e) {
      var lineNumber = e.lineNumber,
          message = (lineNumber == null ? '' : (lineNumber + ': ')) + e.message;

      self._ = { 'VERSION': message };
    }
    postMessage(_.VERSION);
  }
}, false);
