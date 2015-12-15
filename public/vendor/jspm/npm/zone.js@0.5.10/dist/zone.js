/* */ 
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var core = require('../core');
var browserPatch = require('../patch/browser');

if (global.Zone) {
  console.warn('Zone already exported on window the object!');
}

global.Zone = core.Zone;
global.zone = new global.Zone();

browserPatch.apply();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../core":2,"../patch/browser":4}],2:[function(require,module,exports){
(function (global){
'use strict';

var keys = require('./keys');

function Zone(parentZone, data) {
  var zone = (arguments.length) ? Object.create(parentZone) : this;

  zone.parent = parentZone || null;

  Object.keys(data || {}).forEach(function(property) {

    var _property = property.substr(1);

    // augment the new zone with a hook decorates the parent's hook
    if (property[0] === '$') {
      zone[_property] = data[property](parentZone[_property] || function () {});

    // augment the new zone with a hook that runs after the parent's hook
    } else if (property[0] === '+') {
      if (parentZone[_property]) {
        zone[_property] = function () {
          var result = parentZone[_property].apply(this, arguments);
          data[property].apply(this, arguments);
          return result;
        };
      } else {
        zone[_property] = data[property];
      }

    // augment the new zone with a hook that runs before the parent's hook
    } else if (property[0] === '-') {
      if (parentZone[_property]) {
        zone[_property] = function () {
          data[property].apply(this, arguments);
          return parentZone[_property].apply(this, arguments);
        };
      } else {
        zone[_property] = data[property];
      }

    // set the new zone's hook (replacing the parent zone's)
    } else {
      zone[property] = (typeof data[property] === 'object') ?
                        JSON.parse(JSON.stringify(data[property])) :
                        data[property];
    }
  });

  zone.$id = Zone.nextId++;

  return zone;
}

Zone.prototype = {
  constructor: Zone,

  fork: function (locals) {
    this.onZoneCreated();
    return new Zone(this, locals);
  },

  bind: function (fn, skipEnqueue) {
    if (typeof fn !== 'function') {
      throw new Error('Expecting function got: ' + fn);
    }
    skipEnqueue || this.enqueueTask(fn);
    var zone = this.isRootZone() ? this : this.fork();
    return function zoneBoundFn() {
      return zone.run(fn, this, arguments);
    };
  },

  bindOnce: function (fn) {
    var boundZone = this;
    return this.bind(function () {
      var result = fn.apply(this, arguments);
      boundZone.dequeueTask(fn);
      return result;
    });
  },

  isRootZone: function() {
    return this.parent === null;
  },

  run: function run (fn, applyTo, applyWith) {
    applyWith = applyWith || [];

    var oldZone = global.zone;

    // MAKE THIS ZONE THE CURRENT ZONE
    global.zone = this;

    try {
      this.beforeTask();
      return fn.apply(applyTo, applyWith);
    } catch (e) {
      if (this.onError) {
        this.onError(e);
      } else {
        throw e;
      }
    } finally {
      this.afterTask();
      // REVERT THE CURRENT ZONE BACK TO THE ORIGINAL ZONE
      global.zone = oldZone;
    }
  },

  // onError is used to override error handling.
  // When a custom error handler is provided, it should most probably rethrow the exception
  // not to break the expected control flow:
  //
  // `promise.then(fnThatThrows).catch(fn);`
  //
  // When this code is executed in a zone with a custom onError handler that doesn't rethrow, the
  // `.catch()` branch will not be taken as the `fnThatThrows` exception will be swallowed by the
  // handler.
  onError: null,
  beforeTask: function () {},
  onZoneCreated: function () {},
  afterTask: function () {},
  enqueueTask: function () {},
  dequeueTask: function () {},
  addEventListener: function () {
    return this[keys.common.addEventListener].apply(this, arguments);
  },
  removeEventListener: function () {
    return this[keys.common.removeEventListener].apply(this, arguments);
  }
};

// Root zone ID === 1
Zone.nextId = 1;

Zone.bindPromiseFn = require('./patch/promise').bindPromiseFn;

module.exports = {
  Zone: Zone
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./keys":3,"./patch/promise":11}],3:[function(require,module,exports){
/**
 * Creates keys for `private` properties on exposed objects to minimize interactions with other codebases.
 */

function create(name) {
  // `Symbol` implementation is broken in Chrome 39.0.2171, do not use them even if they are available
  return '_zone$' + name;
}

var commonKeys = {
  addEventListener: create('addEventListener'),
  removeEventListener: create('removeEventListener')
};

module.exports = {
  create: create,
  common: commonKeys
};

},{}],4:[function(require,module,exports){
(function (global){
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
  fnPatch.patchSetClearFunction(global, [
    'timeout',
    'interval',
    'immediate'
  ]);

  fnPatch.patchRequestAnimationFrame(global, [
    'requestAnimationFrame',
    'mozRequestAnimationFrame',
    'webkitRequestAnimationFrame'
  ]);

  fnPatch.patchFunction(global, [
    'alert',
    'prompt'
  ]);

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

module.exports = {
  apply: apply
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./define-property":5,"./event-target":6,"./file-reader":7,"./functions":8,"./geolocation":9,"./mutation-observer":10,"./promise":11,"./property-descriptor":12,"./register-element":13,"./websocket":14}],5:[function(require,module,exports){
'use strict';

var keys = require('../keys');

// might need similar for object.freeze
// i regret nothing

var _defineProperty = Object.defineProperty;
var _getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var _create = Object.create;
var unconfigurablesKey = keys.create('unconfigurables');

function apply() {
  Object.defineProperty = function (obj, prop, desc) {
    if (isUnconfigurable(obj, prop)) {
      throw new TypeError('Cannot assign to read only property \'' + prop + '\' of ' + obj);
    }
    if (prop !== 'prototype') {
      desc = rewriteDescriptor(obj, prop, desc);
    }
    return _defineProperty(obj, prop, desc);
  };

  Object.defineProperties = function (obj, props) {
    Object.keys(props).forEach(function (prop) {
      Object.defineProperty(obj, prop, props[prop]);
    });
    return obj;
  };

  Object.create = function (obj, proto) {
    if (typeof proto === 'object') {
      Object.keys(proto).forEach(function (prop) {
        proto[prop] = rewriteDescriptor(obj, prop, proto[prop]);
      });
    }
    return _create(obj, proto);
  };

  Object.getOwnPropertyDescriptor = function (obj, prop) {
    var desc = _getOwnPropertyDescriptor(obj, prop);
    if (isUnconfigurable(obj, prop)) {
      desc.configurable = false;
    }
    return desc;
  };
};

function _redefineProperty(obj, prop, desc) {
  desc = rewriteDescriptor(obj, prop, desc);
  return _defineProperty(obj, prop, desc);
};

function isUnconfigurable (obj, prop) {
  return obj && obj[unconfigurablesKey] && obj[unconfigurablesKey][prop];
}

function rewriteDescriptor (obj, prop, desc) {
  desc.configurable = true;
  if (!desc.configurable) {
    if (!obj[unconfigurablesKey]) {
      _defineProperty(obj, unconfigurablesKey, { writable: true, value: {} });
    }
    obj[unconfigurablesKey][prop] = true;
  }
  return desc;
}

module.exports = {
  apply: apply,
  _redefineProperty: _redefineProperty
};



},{"../keys":3}],6:[function(require,module,exports){
(function (global){
'use strict';

var utils = require('../utils');

function apply() {
  // patched properties depend on addEventListener, so this needs to come first
  if (global.EventTarget) {
    utils.patchEventTargetMethods(global.EventTarget.prototype);

  // Note: EventTarget is not available in all browsers,
  // if it's not available, we instead patch the APIs in the IDL that inherit from EventTarget
  } else {
    var apis = [
      'ApplicationCache',
      'EventSource',
      'FileReader',
      'InputMethodContext',
      'MediaController',
      'MessagePort',
      'Node',
      'Performance',
      'SVGElementInstance',
      'SharedWorker',
      'TextTrack',
      'TextTrackCue',
      'TextTrackList',
      'WebKitNamedFlow',
      'Worker',
      'WorkerGlobalScope',
      'XMLHttpRequest',
      'XMLHttpRequestEventTarget',
      'XMLHttpRequestUpload'
    ];

    apis.forEach(function(api) {
      var proto = global[api] && global[api].prototype;

      // Some browsers e.g. Android 4.3's don't actually implement
      // the EventTarget methods for all of these e.g. FileReader.
      // In this case, there is nothing to patch.
      if (proto && proto.addEventListener) {
        utils.patchEventTargetMethods(proto);
      }
    });

    // Patch the methods on `window` instead of `Window.prototype`
    // `Window` is not accessible on Android 4.3
    if (typeof(window) !== 'undefined') {
      utils.patchEventTargetMethods(window);
    }
  }
}

module.exports = {
  apply: apply
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils":15}],7:[function(require,module,exports){
'use strict';

var utils = require('../utils');

function apply() {
  utils.patchClass('FileReader');
}

module.exports = {
  apply: apply
};
},{"../utils":15}],8:[function(require,module,exports){
(function (global){
'use strict';

var utils = require('../utils');

function patchSetClearFunction(obj, fnNames) {
  fnNames.map(function (name) {
    return name[0].toUpperCase() + name.substr(1);
  }).forEach(function (name) {
    var setName = 'set' + name;
    var delegate = obj[setName];

    if (delegate) {
      var clearName = 'clear' + name;
      var ids = {};

      var bindArgs = setName === 'setInterval' ? utils.bindArguments : utils.bindArgumentsOnce;

      global.zone[setName] = function (fn) {
        var id, fnRef = fn;
        arguments[0] = function () {
          delete ids[id];
          return fnRef.apply(this, arguments);
        };
        var args = bindArgs(arguments);
        id = delegate.apply(obj, args);
        ids[id] = true;
        return id;
      };

      obj[setName] = function () {
        return global.zone[setName].apply(this, arguments);
      };

      var clearDelegate = obj[clearName];

      global.zone[clearName] = function (id) {
        if (ids[id]) {
          delete ids[id];
          global.zone.dequeueTask();
        }
        return clearDelegate.apply(this, arguments);
      };

      obj[clearName] = function () {
        return global.zone[clearName].apply(this, arguments);
      };
    }
  });
};


/**
 * requestAnimationFrame is typically recursively called from within the callback function
 * that it executes.  To handle this case, only fork a zone if this is executed
 * within the root zone.
 */
function patchRequestAnimationFrame(obj, fnNames) {
  fnNames.forEach(function (name) {
    var delegate = obj[name];
    if (delegate) {
      global.zone[name] = function (fn) {
        var callZone = global.zone.isRootZone() ? global.zone.fork() : global.zone;
        if (fn) {
          arguments[0] = function () {
            return callZone.run(fn, this, arguments);
          };
        }
        return delegate.apply(obj, arguments);
      };

      obj[name] = function () {
        return global.zone[name].apply(this, arguments);
      };
    }
  });
};

function patchSetFunction(obj, fnNames) {
  fnNames.forEach(function (name) {
    var delegate = obj[name];

    if (delegate) {
      global.zone[name] = function (fn) {
        arguments[0] = function () {
          return fn.apply(this, arguments);
        };
        var args = utils.bindArgumentsOnce(arguments);
        return delegate.apply(obj, args);
      };

      obj[name] = function () {
        return zone[name].apply(this, arguments);
      };
    }
  });
};

function patchFunction(obj, fnNames) {
  fnNames.forEach(function (name) {
    var delegate = obj[name];
    global.zone[name] = function () {
      return delegate.apply(obj, arguments);
    };

    obj[name] = function () {
      return global.zone[name].apply(this, arguments);
    };
  });
};


module.exports = {
  patchSetClearFunction: patchSetClearFunction,
  patchSetFunction: patchSetFunction,
  patchRequestAnimationFrame: patchRequestAnimationFrame,
  patchFunction: patchFunction
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils":15}],9:[function(require,module,exports){
(function (global){
'use strict';

var utils = require('../utils');

function apply() {
  if (global.navigator && global.navigator.geolocation) {
    utils.patchPrototype(global.navigator.geolocation, [
      'getCurrentPosition',
      'watchPosition'
    ]);
  }
}

module.exports = {
  apply: apply
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils":15}],10:[function(require,module,exports){
(function (global){
'use strict';

var keys = require('../keys');

var originalInstanceKey = keys.create('originalInstance');
var creationZoneKey = keys.create('creationZone');
var isActiveKey = keys.create('isActive');

// wrap some native API on `window`
function patchClass(className) {
  var OriginalClass = global[className];
  if (!OriginalClass) return;

  global[className] = function (fn) {
    this[originalInstanceKey] = new OriginalClass(global.zone.bind(fn, true));
    // Remember where the class was instantiate to execute the enqueueTask and dequeueTask hooks
    this[creationZoneKey] = global.zone;
  };

  var instance = new OriginalClass(function () {});

  global[className].prototype.disconnect = function () {
    var result = this[originalInstanceKey].disconnect.apply(this[originalInstanceKey], arguments);
    if (this[isActiveKey]) {
      this[creationZoneKey].dequeueTask();
      this[isActiveKey] = false;
    }
    return result;
  };

  global[className].prototype.observe = function () {
    if (!this[isActiveKey]) {
      this[creationZoneKey].enqueueTask();
      this[isActiveKey] = true;
    }
    return this[originalInstanceKey].observe.apply(this[originalInstanceKey], arguments);
  };

  var prop;
  for (prop in instance) {
    (function (prop) {
      if (typeof global[className].prototype !== 'undefined') {
        return;
      }
      if (typeof instance[prop] === 'function') {
        global[className].prototype[prop] = function () {
          return this[originalInstanceKey][prop].apply(this[originalInstanceKey], arguments);
        };
      } else {
        Object.defineProperty(global[className].prototype, prop, {
          set: function (fn) {
            if (typeof fn === 'function') {
              this[originalInstanceKey][prop] = global.zone.bind(fn);
            } else {
              this[originalInstanceKey][prop] = fn;
            }
          },
          get: function () {
            return this[originalInstanceKey][prop];
          }
        });
      }
    }(prop));
  }
};

module.exports = {
  patchClass: patchClass
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../keys":3}],11:[function(require,module,exports){
(function (global){
'use strict';

var utils = require('../utils');

/*
 * Patches a function that returns a Promise-like instance.
 *
 * This function must be used when either:
 * - Native Promises are not available,
 * - The function returns a Promise-like object.
 *
 * This is required because zones rely on a Promise monkey patch that could not be applied when
 * Promise is not natively available or when the returned object is not an instance of Promise.
 *
 * Note that calling `bindPromiseFn` on a function that returns a native Promise will also work
 * with minimal overhead.
 *
 * ```
 * var boundFunction = bindPromiseFn(FunctionReturningAPromise);
 *
 * boundFunction.then(successHandler, errorHandler);
 * ```
 */
var bindPromiseFn;

if (global.Promise) {
  bindPromiseFn = function (delegate) {
    return function() {
      var delegatePromise = delegate.apply(this, arguments);

      // if the delegate returned an instance of Promise, forward it.
      if (delegatePromise instanceof Promise) {
        return delegatePromise;
      }

      // Otherwise wrap the Promise-like in a global Promise
      return new Promise(function(resolve, reject) {
        delegatePromise.then(resolve, reject);
      });
    };
  };
} else {
  bindPromiseFn = function (delegate) {
    return function () {
      return _patchThenable(delegate.apply(this, arguments));
    };
  };
}


function _patchPromiseFnsOnObject(objectPath, fnNames) {
  var obj = global;

  var exists = objectPath.every(function (segment) {
    obj = obj[segment];
    return obj;
  });

  if (!exists) {
    return;
  }

  fnNames.forEach(function (name) {
    var fn = obj[name];
    if (fn) {
      obj[name] = bindPromiseFn(fn);
    }
  });
}

function _patchThenable(thenable) {
  var then = thenable.then;
  thenable.then = function () {
    var args = utils.bindArguments(arguments);
    var nextThenable = then.apply(thenable, args);
    return _patchThenable(nextThenable);
  };

  var ocatch = thenable.catch;
  thenable.catch = function () {
    var args = utils.bindArguments(arguments);
    var nextThenable = ocatch.apply(thenable, args);
    return _patchThenable(nextThenable);
  };

  return thenable;
}


function apply() {
  // Patch .then() and .catch() on native Promises to execute callbacks in the zone where
  // those functions are called.
  if (global.Promise) {
    utils.patchPrototype(Promise.prototype, [
      'then',
      'catch'
    ]);

    // Patch browser APIs that return a Promise
    var patchFns = [
      // fetch
      [[], ['fetch']],
      [['Response', 'prototype'], ['arrayBuffer', 'blob', 'json', 'text']]
    ];

    patchFns.forEach(function(objPathAndFns) {
      _patchPromiseFnsOnObject(objPathAndFns[0], objPathAndFns[1]);
    });
  }
}

module.exports = {
  apply: apply,
  bindPromiseFn: bindPromiseFn
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils":15}],12:[function(require,module,exports){
(function (global){
'use strict';

var webSocketPatch = require('./websocket');
var utils = require('../utils');
var keys = require('../keys');

var eventNames = 'copy cut paste abort blur focus canplay canplaythrough change click contextmenu dblclick drag dragend dragenter dragleave dragover dragstart drop durationchange emptied ended input invalid keydown keypress keyup load loadeddata loadedmetadata loadstart message mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup pause play playing progress ratechange reset scroll seeked seeking select show stalled submit suspend timeupdate volumechange waiting mozfullscreenchange mozfullscreenerror mozpointerlockchange mozpointerlockerror error webglcontextrestored webglcontextlost webglcontextcreationerror'.split(' ');

function apply() {
  if (utils.isWebWorker()){
    // on WebWorker so don't apply patch
    return;
  }

  var supportsWebSocket = typeof WebSocket !== 'undefined';
  if (canPatchViaPropertyDescriptor()) {
    // for browsers that we can patch the descriptor:  Chrome & Firefox
    var onEventNames = eventNames.map(function (property) {
      return 'on' + property;
    });
    utils.patchProperties(HTMLElement.prototype, onEventNames);
    utils.patchProperties(XMLHttpRequest.prototype);
    if (supportsWebSocket) {
      utils.patchProperties(WebSocket.prototype);
    }
  } else {
    // Safari, Android browsers (Jelly Bean)
    patchViaCapturingAllTheEvents();
    utils.patchClass('XMLHttpRequest');
    if (supportsWebSocket) {
      webSocketPatch.apply();
    }
  }
}

function canPatchViaPropertyDescriptor() {
  if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onclick') && typeof Element !== 'undefined') {
    // WebKit https://bugs.webkit.org/show_bug.cgi?id=134364
    // IDL interface attributes are not configurable
    var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'onclick');
    if (desc && !desc.configurable) return false;
  }

  Object.defineProperty(HTMLElement.prototype, 'onclick', {
    get: function () {
      return true;
    }
  });
  var elt = document.createElement('div');
  var result = !!elt.onclick;
  Object.defineProperty(HTMLElement.prototype, 'onclick', {});
  return result;
};

var unboundKey = keys.create('unbound');

// Whenever any event fires, we check the event target and all parents
// for `onwhatever` properties and replace them with zone-bound functions
// - Chrome (for now)
function patchViaCapturingAllTheEvents() {
  eventNames.forEach(function (property) {
    var onproperty = 'on' + property;
    document.addEventListener(property, function (event) {
      var elt = event.target, bound;
      while (elt) {
        if (elt[onproperty] && !elt[onproperty][unboundKey]) {
          bound = global.zone.bind(elt[onproperty]);
          bound[unboundKey] = elt[onproperty];
          elt[onproperty] = bound;
        }
        elt = elt.parentElement;
      }
    }, true);
  });
};

module.exports = {
  apply: apply
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../keys":3,"../utils":15,"./websocket":14}],13:[function(require,module,exports){
(function (global){
'use strict';

var _redefineProperty = require('./define-property')._redefineProperty;
var utils = require("../utils");

function apply() {
  if (utils.isWebWorker() || !('registerElement' in global.document)) {
    return;
  }

  var _registerElement = document.registerElement;
  var callbacks = [
    'createdCallback',
    'attachedCallback',
    'detachedCallback',
    'attributeChangedCallback'
  ];

  document.registerElement = function (name, opts) {
    if (opts && opts.prototype) {
      callbacks.forEach(function (callback) {
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

module.exports = {
  apply: apply
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils":15,"./define-property":5}],14:[function(require,module,exports){
(function (global){
'use strict';

var utils = require('../utils');

// we have to patch the instance since the proto is non-configurable
function apply() {
  var WS = global.WebSocket;
  utils.patchEventTargetMethods(WS.prototype);
  global.WebSocket = function(a, b) {
    var socket = arguments.length > 1 ? new WS(a, b) : new WS(a);
    var proxySocket;

    // Safari 7.0 has non-configurable own 'onmessage' and friends properties on the socket instance
    var onmessageDesc = Object.getOwnPropertyDescriptor(socket, 'onmessage');
    if (onmessageDesc && onmessageDesc.configurable === false) {
      proxySocket = Object.create(socket);
      ['addEventListener', 'removeEventListener', 'send', 'close'].forEach(function(propName) {
        proxySocket[propName] = function() {
          return socket[propName].apply(socket, arguments);
        };
      });
    } else {
      // we can patch the real socket
      proxySocket = socket;
    }

    utils.patchProperties(proxySocket, ['onclose', 'onerror', 'onmessage', 'onopen']);

    return proxySocket;
  };
}

module.exports = {
  apply: apply
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils":15}],15:[function(require,module,exports){
(function (global){
'use strict';

var keys = require('./keys');

function bindArguments(args) {
  for (var i = args.length - 1; i >= 0; i--) {
    if (typeof args[i] === 'function') {
      args[i] = global.zone.bind(args[i]);
    }
  }
  return args;
};

function bindArgumentsOnce(args) {
  for (var i = args.length - 1; i >= 0; i--) {
    if (typeof args[i] === 'function') {
      args[i] = global.zone.bindOnce(args[i]);
    }
  }
  return args;
};

function patchPrototype(obj, fnNames) {
  fnNames.forEach(function (name) {
    var delegate = obj[name];
    if (delegate) {
      obj[name] = function () {
        return delegate.apply(this, bindArguments(arguments));
      };
    }
  });
};

function isWebWorker() {
  return (typeof document === "undefined");
}

function patchProperty(obj, prop) {
  var desc = Object.getOwnPropertyDescriptor(obj, prop) || {
    enumerable: true,
    configurable: true
  };

  // A property descriptor cannot have getter/setter and be writable
  // deleting the writable and value properties avoids this error:
  //
  // TypeError: property descriptors must not specify a value or be writable when a
  // getter or setter has been specified
  delete desc.writable;
  delete desc.value;

  // substr(2) cuz 'onclick' -> 'click', etc
  var eventName = prop.substr(2);
  var _prop = '_' + prop;

  desc.set = function (fn) {
    if (this[_prop]) {
      this.removeEventListener(eventName, this[_prop]);
    }

    if (typeof fn === 'function') {
      this[_prop] = fn;
      this.addEventListener(eventName, fn, false);
    } else {
      this[_prop] = null;
    }
  };

  desc.get = function () {
    return this[_prop];
  };

  Object.defineProperty(obj, prop, desc);
};

function patchProperties(obj, properties) {
  (properties || (function () {
      var props = [];
      for (var prop in obj) {
        props.push(prop);
      }
      return props;
    }()).
    filter(function (propertyName) {
      return propertyName.substr(0,2) === 'on';
    })).
    forEach(function (eventName) {
      patchProperty(obj, eventName);
    });
};

var originalFnKey = keys.create('originalFn');
var boundFnsKey = keys.create('boundFns');

function patchEventTargetMethods(obj) {
  // This is required for the addEventListener hook on the root zone.
  obj[keys.common.addEventListener] = obj.addEventListener;
  obj.addEventListener = function (eventName, handler, useCapturing) {
    //Ignore special listeners of IE11 & Edge dev tools, see https://github.com/angular/zone.js/issues/150
    if (handler && handler.toString() !== "[object FunctionWrapper]") {
      var eventType = eventName + (useCapturing ? '$capturing' : '$bubbling');
      var fn;
      if (handler.handleEvent) {
        // Have to pass in 'handler' reference as an argument here, otherwise it gets clobbered in
        // IE9 by the arguments[1] assignment at end of this function.
        fn = (function(handler) {
          return function() {
            handler.handleEvent.apply(handler, arguments);
          };
        })(handler);
      } else {
        fn = handler;
      }

      handler[originalFnKey] = fn;
      handler[boundFnsKey] = handler[boundFnsKey] || {};
      handler[boundFnsKey][eventType] = handler[boundFnsKey][eventType] || zone.bind(fn);
      arguments[1] = handler[boundFnsKey][eventType];
    }

    // - Inside a Web Worker, `this` is undefined, the context is `global` (= `self`)
    // - When `addEventListener` is called on the global context in strict mode, `this` is undefined
    // see https://github.com/angular/zone.js/issues/190
    var target = this || global;
    return global.zone.addEventListener.apply(target, arguments);
  };

  // This is required for the removeEventListener hook on the root zone.
  obj[keys.common.removeEventListener] = obj.removeEventListener;
  obj.removeEventListener = function (eventName, handler, useCapturing) {
    var eventType = eventName + (useCapturing ? '$capturing' : '$bubbling');
    if (handler && handler[boundFnsKey] && handler[boundFnsKey][eventType]) {
      var _bound = handler[boundFnsKey];
      arguments[1] = _bound[eventType];
      delete _bound[eventType];
      global.zone.dequeueTask(handler[originalFnKey]);
    }

    // - Inside a Web Worker, `this` is undefined, the context is `global`
    // - When `addEventListener` is called on the global context in strict mode, `this` is undefined
    // see https://github.com/angular/zone.js/issues/190
    var target = this || global;
    var result = global.zone.removeEventListener.apply(target, arguments);
    return result;
  };
};

var originalInstanceKey = keys.create('originalInstance');

// wrap some native API on `window`
function patchClass(className) {
  var OriginalClass = global[className];
  if (!OriginalClass) return;

  global[className] = function () {
    var a = bindArguments(arguments);
    switch (a.length) {
      case 0: this[originalInstanceKey] = new OriginalClass(); break;
      case 1: this[originalInstanceKey] = new OriginalClass(a[0]); break;
      case 2: this[originalInstanceKey] = new OriginalClass(a[0], a[1]); break;
      case 3: this[originalInstanceKey] = new OriginalClass(a[0], a[1], a[2]); break;
      case 4: this[originalInstanceKey] = new OriginalClass(a[0], a[1], a[2], a[3]); break;
      default: throw new Error('what are you even doing?');
    }
  };

  var instance = new OriginalClass();

  var prop;
  for (prop in instance) {
    (function (prop) {
      if (typeof instance[prop] === 'function') {
        global[className].prototype[prop] = function () {
          return this[originalInstanceKey][prop].apply(this[originalInstanceKey], arguments);
        };
      } else {
        Object.defineProperty(global[className].prototype, prop, {
          set: function (fn) {
            if (typeof fn === 'function') {
              this[originalInstanceKey][prop] = global.zone.bind(fn);
            } else {
              this[originalInstanceKey][prop] = fn;
            }
          },
          get: function () {
            return this[originalInstanceKey][prop];
          }
        });
      }
    }(prop));
  }

  for (prop in OriginalClass) {
    if (prop !== 'prototype' && OriginalClass.hasOwnProperty(prop)) {
      global[className][prop] = OriginalClass[prop];
    }
  }
};

module.exports = {
  bindArguments: bindArguments,
  bindArgumentsOnce: bindArgumentsOnce,
  patchPrototype: patchPrototype,
  patchProperty: patchProperty,
  patchProperties: patchProperties,
  patchEventTargetMethods: patchEventTargetMethods,
  patchClass: patchClass,
  isWebWorker: isWebWorker
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./keys":3}]},{},[1]);
