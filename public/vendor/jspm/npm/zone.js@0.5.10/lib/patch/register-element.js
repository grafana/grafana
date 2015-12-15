/* */ 
'use strict';
var _redefineProperty = require('./define-property')._redefineProperty;
var utils = require('../utils');
function apply() {
  if (utils.isWebWorker() || !('registerElement' in global.document)) {
    return;
  }
  var _registerElement = document.registerElement;
  var callbacks = ['createdCallback', 'attachedCallback', 'detachedCallback', 'attributeChangedCallback'];
  document.registerElement = function(name, opts) {
    if (opts && opts.prototype) {
      callbacks.forEach(function(callback) {
        if (opts.prototype.hasOwnProperty(callback)) {
          var descriptor = Object.getOwnPropertyDescriptor(opts.prototype, callback);
          if (descriptor && descriptor.value) {
            descriptor.value = global.zone.bind(descriptor.value);
            _redefineProperty(opts.prototype, callback, descriptor);
          } else {
            opts.prototype[callback] = global.zone.bind(opts.prototype[callback]);
          }
        } else if (opts.prototype[callback]) {
          opts.prototype[callback] = global.zone.bind(opts.prototype[callback]);
        }
      });
    }
    return _registerElement.apply(document, [name, opts]);
  };
}
module.exports = {apply: apply};
