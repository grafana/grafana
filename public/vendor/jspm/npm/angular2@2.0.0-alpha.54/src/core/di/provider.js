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
var __decorate = (this && this.__decorate) || function(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
};
var lang_1 = require('../../facade/lang');
var exceptions_1 = require('../../facade/exceptions');
var collection_1 = require('../../facade/collection');
var reflection_1 = require('../reflection/reflection');
var key_1 = require('./key');
var metadata_1 = require('./metadata');
var exceptions_2 = require('./exceptions');
var forward_ref_1 = require('./forward_ref');
var Dependency = (function() {
  function Dependency(key, optional, lowerBoundVisibility, upperBoundVisibility, properties) {
    this.key = key;
    this.optional = optional;
    this.lowerBoundVisibility = lowerBoundVisibility;
    this.upperBoundVisibility = upperBoundVisibility;
    this.properties = properties;
  }
  Dependency.fromKey = function(key) {
    return new Dependency(key, false, null, null, []);
  };
  return Dependency;
})();
exports.Dependency = Dependency;
var _EMPTY_LIST = lang_1.CONST_EXPR([]);
var Provider = (function() {
  function Provider(token, _a) {
    var useClass = _a.useClass,
        useValue = _a.useValue,
        useExisting = _a.useExisting,
        useFactory = _a.useFactory,
        deps = _a.deps,
        multi = _a.multi;
    this.token = token;
    this.useClass = useClass;
    this.useValue = useValue;
    this.useExisting = useExisting;
    this.useFactory = useFactory;
    this.dependencies = deps;
    this._multi = multi;
  }
  Object.defineProperty(Provider.prototype, "multi", {
    get: function() {
      return lang_1.normalizeBool(this._multi);
    },
    enumerable: true,
    configurable: true
  });
  Provider = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object, Object])], Provider);
  return Provider;
})();
exports.Provider = Provider;
var Binding = (function(_super) {
  __extends(Binding, _super);
  function Binding(token, _a) {
    var toClass = _a.toClass,
        toValue = _a.toValue,
        toAlias = _a.toAlias,
        toFactory = _a.toFactory,
        deps = _a.deps,
        multi = _a.multi;
    _super.call(this, token, {
      useClass: toClass,
      useValue: toValue,
      useExisting: toAlias,
      useFactory: toFactory,
      deps: deps,
      multi: multi
    });
  }
  Object.defineProperty(Binding.prototype, "toClass", {
    get: function() {
      return this.useClass;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Binding.prototype, "toAlias", {
    get: function() {
      return this.useExisting;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Binding.prototype, "toFactory", {
    get: function() {
      return this.useFactory;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Binding.prototype, "toValue", {
    get: function() {
      return this.useValue;
    },
    enumerable: true,
    configurable: true
  });
  Binding = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object, Object])], Binding);
  return Binding;
})(Provider);
exports.Binding = Binding;
var ResolvedProvider_ = (function() {
  function ResolvedProvider_(key, resolvedFactories, multiProvider) {
    this.key = key;
    this.resolvedFactories = resolvedFactories;
    this.multiProvider = multiProvider;
  }
  Object.defineProperty(ResolvedProvider_.prototype, "resolvedFactory", {
    get: function() {
      return this.resolvedFactories[0];
    },
    enumerable: true,
    configurable: true
  });
  return ResolvedProvider_;
})();
exports.ResolvedProvider_ = ResolvedProvider_;
var ResolvedFactory = (function() {
  function ResolvedFactory(factory, dependencies) {
    this.factory = factory;
    this.dependencies = dependencies;
  }
  return ResolvedFactory;
})();
exports.ResolvedFactory = ResolvedFactory;
function bind(token) {
  return new ProviderBuilder(token);
}
exports.bind = bind;
function provide(token, _a) {
  var useClass = _a.useClass,
      useValue = _a.useValue,
      useExisting = _a.useExisting,
      useFactory = _a.useFactory,
      deps = _a.deps,
      multi = _a.multi;
  return new Provider(token, {
    useClass: useClass,
    useValue: useValue,
    useExisting: useExisting,
    useFactory: useFactory,
    deps: deps,
    multi: multi
  });
}
exports.provide = provide;
var ProviderBuilder = (function() {
  function ProviderBuilder(token) {
    this.token = token;
  }
  ProviderBuilder.prototype.toClass = function(type) {
    if (!lang_1.isType(type)) {
      throw new exceptions_1.BaseException("Trying to create a class provider but \"" + lang_1.stringify(type) + "\" is not a class!");
    }
    return new Provider(this.token, {useClass: type});
  };
  ProviderBuilder.prototype.toValue = function(value) {
    return new Provider(this.token, {useValue: value});
  };
  ProviderBuilder.prototype.toAlias = function(aliasToken) {
    if (lang_1.isBlank(aliasToken)) {
      throw new exceptions_1.BaseException("Can not alias " + lang_1.stringify(this.token) + " to a blank value!");
    }
    return new Provider(this.token, {useExisting: aliasToken});
  };
  ProviderBuilder.prototype.toFactory = function(factory, dependencies) {
    if (!lang_1.isFunction(factory)) {
      throw new exceptions_1.BaseException("Trying to create a factory provider but \"" + lang_1.stringify(factory) + "\" is not a function!");
    }
    return new Provider(this.token, {
      useFactory: factory,
      deps: dependencies
    });
  };
  return ProviderBuilder;
})();
exports.ProviderBuilder = ProviderBuilder;
function resolveFactory(provider) {
  var factoryFn;
  var resolvedDeps;
  if (lang_1.isPresent(provider.useClass)) {
    var useClass = forward_ref_1.resolveForwardRef(provider.useClass);
    factoryFn = reflection_1.reflector.factory(useClass);
    resolvedDeps = _dependenciesFor(useClass);
  } else if (lang_1.isPresent(provider.useExisting)) {
    factoryFn = function(aliasInstance) {
      return aliasInstance;
    };
    resolvedDeps = [Dependency.fromKey(key_1.Key.get(provider.useExisting))];
  } else if (lang_1.isPresent(provider.useFactory)) {
    factoryFn = provider.useFactory;
    resolvedDeps = _constructDependencies(provider.useFactory, provider.dependencies);
  } else {
    factoryFn = function() {
      return provider.useValue;
    };
    resolvedDeps = _EMPTY_LIST;
  }
  return new ResolvedFactory(factoryFn, resolvedDeps);
}
exports.resolveFactory = resolveFactory;
function resolveProvider(provider) {
  return new ResolvedProvider_(key_1.Key.get(provider.token), [resolveFactory(provider)], false);
}
exports.resolveProvider = resolveProvider;
function resolveProviders(providers) {
  var normalized = _createListOfProviders(_normalizeProviders(providers, new Map()));
  return normalized.map(function(b) {
    if (b instanceof _NormalizedProvider) {
      return new ResolvedProvider_(b.key, [b.resolvedFactory], false);
    } else {
      var arr = b;
      return new ResolvedProvider_(arr[0].key, arr.map(function(_) {
        return _.resolvedFactory;
      }), true);
    }
  });
}
exports.resolveProviders = resolveProviders;
var _NormalizedProvider = (function() {
  function _NormalizedProvider(key, resolvedFactory) {
    this.key = key;
    this.resolvedFactory = resolvedFactory;
  }
  return _NormalizedProvider;
})();
function _createListOfProviders(flattenedProviders) {
  return collection_1.MapWrapper.values(flattenedProviders);
}
function _normalizeProviders(providers, res) {
  providers.forEach(function(b) {
    if (b instanceof lang_1.Type) {
      _normalizeProvider(provide(b, {useClass: b}), res);
    } else if (b instanceof Provider) {
      _normalizeProvider(b, res);
    } else if (b instanceof Array) {
      _normalizeProviders(b, res);
    } else if (b instanceof ProviderBuilder) {
      throw new exceptions_2.InvalidProviderError(b.token);
    } else {
      throw new exceptions_2.InvalidProviderError(b);
    }
  });
  return res;
}
function _normalizeProvider(b, res) {
  var key = key_1.Key.get(b.token);
  var factory = resolveFactory(b);
  var normalized = new _NormalizedProvider(key, factory);
  if (b.multi) {
    var existingProvider = res.get(key.id);
    if (existingProvider instanceof Array) {
      existingProvider.push(normalized);
    } else if (lang_1.isBlank(existingProvider)) {
      res.set(key.id, [normalized]);
    } else {
      throw new exceptions_2.MixingMultiProvidersWithRegularProvidersError(existingProvider, b);
    }
  } else {
    var existingProvider = res.get(key.id);
    if (existingProvider instanceof Array) {
      throw new exceptions_2.MixingMultiProvidersWithRegularProvidersError(existingProvider, b);
    }
    res.set(key.id, normalized);
  }
}
function _constructDependencies(factoryFunction, dependencies) {
  if (lang_1.isBlank(dependencies)) {
    return _dependenciesFor(factoryFunction);
  } else {
    var params = dependencies.map(function(t) {
      return [t];
    });
    return dependencies.map(function(t) {
      return _extractToken(factoryFunction, t, params);
    });
  }
}
function _dependenciesFor(typeOrFunc) {
  var params = reflection_1.reflector.parameters(typeOrFunc);
  if (lang_1.isBlank(params))
    return [];
  if (params.some(lang_1.isBlank)) {
    throw new exceptions_2.NoAnnotationError(typeOrFunc, params);
  }
  return params.map(function(p) {
    return _extractToken(typeOrFunc, p, params);
  });
}
function _extractToken(typeOrFunc, metadata, params) {
  var depProps = [];
  var token = null;
  var optional = false;
  if (!lang_1.isArray(metadata)) {
    if (metadata instanceof metadata_1.InjectMetadata) {
      return _createDependency(metadata.token, optional, null, null, depProps);
    } else {
      return _createDependency(metadata, optional, null, null, depProps);
    }
  }
  var lowerBoundVisibility = null;
  var upperBoundVisibility = null;
  for (var i = 0; i < metadata.length; ++i) {
    var paramMetadata = metadata[i];
    if (paramMetadata instanceof lang_1.Type) {
      token = paramMetadata;
    } else if (paramMetadata instanceof metadata_1.InjectMetadata) {
      token = paramMetadata.token;
    } else if (paramMetadata instanceof metadata_1.OptionalMetadata) {
      optional = true;
    } else if (paramMetadata instanceof metadata_1.SelfMetadata) {
      upperBoundVisibility = paramMetadata;
    } else if (paramMetadata instanceof metadata_1.HostMetadata) {
      upperBoundVisibility = paramMetadata;
    } else if (paramMetadata instanceof metadata_1.SkipSelfMetadata) {
      lowerBoundVisibility = paramMetadata;
    } else if (paramMetadata instanceof metadata_1.DependencyMetadata) {
      if (lang_1.isPresent(paramMetadata.token)) {
        token = paramMetadata.token;
      }
      depProps.push(paramMetadata);
    }
  }
  token = forward_ref_1.resolveForwardRef(token);
  if (lang_1.isPresent(token)) {
    return _createDependency(token, optional, lowerBoundVisibility, upperBoundVisibility, depProps);
  } else {
    throw new exceptions_2.NoAnnotationError(typeOrFunc, params);
  }
}
function _createDependency(token, optional, lowerBoundVisibility, upperBoundVisibility, depProps) {
  return new Dependency(key_1.Key.get(token), optional, lowerBoundVisibility, upperBoundVisibility, depProps);
}
