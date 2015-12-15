/* */ 
'use strict';
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ng_zone_1 = require('./zone/ng_zone');
var lang_1 = require('../facade/lang');
var di_1 = require('./di');
var application_tokens_1 = require('./application_tokens');
var async_1 = require('../facade/async');
var collection_1 = require('../facade/collection');
var testability_1 = require('./testability/testability');
var dynamic_component_loader_1 = require('./linker/dynamic_component_loader');
var exceptions_1 = require('../facade/exceptions');
var view_ref_1 = require('./linker/view_ref');
var profile_1 = require('./profile/profile');
var lang_2 = require('../facade/lang');
function _componentProviders(appComponentType) {
  return [di_1.provide(application_tokens_1.APP_COMPONENT, {useValue: appComponentType}), di_1.provide(application_tokens_1.APP_COMPONENT_REF_PROMISE, {
    useFactory: function(dynamicComponentLoader, appRef, injector) {
      var ref;
      return dynamicComponentLoader.loadAsRoot(appComponentType, null, injector, function() {
        appRef._unloadComponent(ref);
      }).then(function(componentRef) {
        ref = componentRef;
        if (lang_1.isPresent(componentRef.location.nativeElement)) {
          injector.get(testability_1.TestabilityRegistry).registerApplication(componentRef.location.nativeElement, injector.get(testability_1.Testability));
        }
        return componentRef;
      });
    },
    deps: [dynamic_component_loader_1.DynamicComponentLoader, ApplicationRef, di_1.Injector]
  }), di_1.provide(appComponentType, {
    useFactory: function(p) {
      return p.then(function(ref) {
        return ref.instance;
      });
    },
    deps: [application_tokens_1.APP_COMPONENT_REF_PROMISE]
  })];
}
function createNgZone() {
  return new ng_zone_1.NgZone({enableLongStackTrace: lang_1.assertionsEnabled()});
}
exports.createNgZone = createNgZone;
var _platform;
var _platformProviders;
function platform(providers) {
  lang_2.lockDevMode();
  if (lang_1.isPresent(_platform)) {
    if (collection_1.ListWrapper.equals(_platformProviders, providers)) {
      return _platform;
    } else {
      throw new exceptions_1.BaseException("platform cannot be initialized with different sets of providers.");
    }
  } else {
    return _createPlatform(providers);
  }
}
exports.platform = platform;
function disposePlatform() {
  if (lang_1.isPresent(_platform)) {
    _platform.dispose();
    _platform = null;
  }
}
exports.disposePlatform = disposePlatform;
function _createPlatform(providers) {
  _platformProviders = providers;
  var injector = di_1.Injector.resolveAndCreate(providers);
  _platform = new PlatformRef_(injector, function() {
    _platform = null;
    _platformProviders = null;
  });
  _runPlatformInitializers(injector);
  return _platform;
}
function _runPlatformInitializers(injector) {
  var inits = injector.getOptional(application_tokens_1.PLATFORM_INITIALIZER);
  if (lang_1.isPresent(inits))
    inits.forEach(function(init) {
      return init();
    });
}
var PlatformRef = (function() {
  function PlatformRef() {}
  Object.defineProperty(PlatformRef.prototype, "injector", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return PlatformRef;
})();
exports.PlatformRef = PlatformRef;
var PlatformRef_ = (function(_super) {
  __extends(PlatformRef_, _super);
  function PlatformRef_(_injector, _dispose) {
    _super.call(this);
    this._injector = _injector;
    this._dispose = _dispose;
    this._applications = [];
    this._disposeListeners = [];
  }
  PlatformRef_.prototype.registerDisposeListener = function(dispose) {
    this._disposeListeners.push(dispose);
  };
  Object.defineProperty(PlatformRef_.prototype, "injector", {
    get: function() {
      return this._injector;
    },
    enumerable: true,
    configurable: true
  });
  PlatformRef_.prototype.application = function(providers) {
    var app = this._initApp(createNgZone(), providers);
    return app;
  };
  PlatformRef_.prototype.asyncApplication = function(bindingFn, additionalProviders) {
    var _this = this;
    var zone = createNgZone();
    var completer = async_1.PromiseWrapper.completer();
    zone.run(function() {
      async_1.PromiseWrapper.then(bindingFn(zone), function(providers) {
        if (lang_1.isPresent(additionalProviders)) {
          providers = collection_1.ListWrapper.concat(providers, additionalProviders);
        }
        completer.resolve(_this._initApp(zone, providers));
      });
    });
    return completer.promise;
  };
  PlatformRef_.prototype._initApp = function(zone, providers) {
    var _this = this;
    var injector;
    var app;
    zone.run(function() {
      providers = collection_1.ListWrapper.concat(providers, [di_1.provide(ng_zone_1.NgZone, {useValue: zone}), di_1.provide(ApplicationRef, {
        useFactory: function() {
          return app;
        },
        deps: []
      })]);
      var exceptionHandler;
      try {
        injector = _this.injector.resolveAndCreateChild(providers);
        exceptionHandler = injector.get(exceptions_1.ExceptionHandler);
        zone.overrideOnErrorHandler(function(e, s) {
          return exceptionHandler.call(e, s);
        });
      } catch (e) {
        if (lang_1.isPresent(exceptionHandler)) {
          exceptionHandler.call(e, e.stack);
        } else {
          lang_1.print(e.toString());
        }
      }
    });
    app = new ApplicationRef_(this, zone, injector);
    this._applications.push(app);
    _runAppInitializers(injector);
    return app;
  };
  PlatformRef_.prototype.dispose = function() {
    collection_1.ListWrapper.clone(this._applications).forEach(function(app) {
      return app.dispose();
    });
    this._disposeListeners.forEach(function(dispose) {
      return dispose();
    });
    this._dispose();
  };
  PlatformRef_.prototype._applicationDisposed = function(app) {
    collection_1.ListWrapper.remove(this._applications, app);
  };
  return PlatformRef_;
})(PlatformRef);
exports.PlatformRef_ = PlatformRef_;
function _runAppInitializers(injector) {
  var inits = injector.getOptional(application_tokens_1.APP_INITIALIZER);
  if (lang_1.isPresent(inits))
    inits.forEach(function(init) {
      return init();
    });
}
var ApplicationRef = (function() {
  function ApplicationRef() {}
  Object.defineProperty(ApplicationRef.prototype, "injector", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(ApplicationRef.prototype, "zone", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(ApplicationRef.prototype, "componentTypes", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return ApplicationRef;
})();
exports.ApplicationRef = ApplicationRef;
var ApplicationRef_ = (function(_super) {
  __extends(ApplicationRef_, _super);
  function ApplicationRef_(_platform, _zone, _injector) {
    var _this = this;
    _super.call(this);
    this._platform = _platform;
    this._zone = _zone;
    this._injector = _injector;
    this._bootstrapListeners = [];
    this._disposeListeners = [];
    this._rootComponents = [];
    this._rootComponentTypes = [];
    this._changeDetectorRefs = [];
    this._runningTick = false;
    this._enforceNoNewChanges = false;
    if (lang_1.isPresent(this._zone)) {
      async_1.ObservableWrapper.subscribe(this._zone.onTurnDone, function(_) {
        _this._zone.run(function() {
          _this.tick();
        });
      });
    }
    this._enforceNoNewChanges = lang_1.assertionsEnabled();
  }
  ApplicationRef_.prototype.registerBootstrapListener = function(listener) {
    this._bootstrapListeners.push(listener);
  };
  ApplicationRef_.prototype.registerDisposeListener = function(dispose) {
    this._disposeListeners.push(dispose);
  };
  ApplicationRef_.prototype.registerChangeDetector = function(changeDetector) {
    this._changeDetectorRefs.push(changeDetector);
  };
  ApplicationRef_.prototype.unregisterChangeDetector = function(changeDetector) {
    collection_1.ListWrapper.remove(this._changeDetectorRefs, changeDetector);
  };
  ApplicationRef_.prototype.bootstrap = function(componentType, providers) {
    var _this = this;
    var completer = async_1.PromiseWrapper.completer();
    this._zone.run(function() {
      var componentProviders = _componentProviders(componentType);
      if (lang_1.isPresent(providers)) {
        componentProviders.push(providers);
      }
      var exceptionHandler = _this._injector.get(exceptions_1.ExceptionHandler);
      _this._rootComponentTypes.push(componentType);
      try {
        var injector = _this._injector.resolveAndCreateChild(componentProviders);
        var compRefToken = injector.get(application_tokens_1.APP_COMPONENT_REF_PROMISE);
        var tick = function(componentRef) {
          _this._loadComponent(componentRef);
          completer.resolve(componentRef);
        };
        var tickResult = async_1.PromiseWrapper.then(compRefToken, tick);
        if (lang_1.IS_DART) {
          async_1.PromiseWrapper.then(tickResult, function(_) {});
        }
        async_1.PromiseWrapper.then(tickResult, null, function(err, stackTrace) {
          return completer.reject(err, stackTrace);
        });
      } catch (e) {
        exceptionHandler.call(e, e.stack);
        completer.reject(e, e.stack);
      }
    });
    return completer.promise;
  };
  ApplicationRef_.prototype._loadComponent = function(ref) {
    var appChangeDetector = view_ref_1.internalView(ref.hostView).changeDetector;
    this._changeDetectorRefs.push(appChangeDetector.ref);
    this.tick();
    this._rootComponents.push(ref);
    this._bootstrapListeners.forEach(function(listener) {
      return listener(ref);
    });
  };
  ApplicationRef_.prototype._unloadComponent = function(ref) {
    if (!collection_1.ListWrapper.contains(this._rootComponents, ref)) {
      return;
    }
    this.unregisterChangeDetector(view_ref_1.internalView(ref.hostView).changeDetector.ref);
    collection_1.ListWrapper.remove(this._rootComponents, ref);
  };
  Object.defineProperty(ApplicationRef_.prototype, "injector", {
    get: function() {
      return this._injector;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(ApplicationRef_.prototype, "zone", {
    get: function() {
      return this._zone;
    },
    enumerable: true,
    configurable: true
  });
  ApplicationRef_.prototype.tick = function() {
    if (this._runningTick) {
      throw new exceptions_1.BaseException("ApplicationRef.tick is called recursively");
    }
    var s = ApplicationRef_._tickScope();
    try {
      this._runningTick = true;
      this._changeDetectorRefs.forEach(function(detector) {
        return detector.detectChanges();
      });
      if (this._enforceNoNewChanges) {
        this._changeDetectorRefs.forEach(function(detector) {
          return detector.checkNoChanges();
        });
      }
    } finally {
      this._runningTick = false;
      profile_1.wtfLeave(s);
    }
  };
  ApplicationRef_.prototype.dispose = function() {
    collection_1.ListWrapper.clone(this._rootComponents).forEach(function(ref) {
      return ref.dispose();
    });
    this._disposeListeners.forEach(function(dispose) {
      return dispose();
    });
    this._platform._applicationDisposed(this);
  };
  Object.defineProperty(ApplicationRef_.prototype, "componentTypes", {
    get: function() {
      return this._rootComponentTypes;
    },
    enumerable: true,
    configurable: true
  });
  ApplicationRef_._tickScope = profile_1.wtfCreateScope('ApplicationRef#tick()');
  return ApplicationRef_;
})(ApplicationRef);
exports.ApplicationRef_ = ApplicationRef_;
