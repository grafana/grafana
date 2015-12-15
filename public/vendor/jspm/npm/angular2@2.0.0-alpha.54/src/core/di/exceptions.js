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
var collection_1 = require('../../facade/collection');
var lang_1 = require('../../facade/lang');
var exceptions_1 = require('../../facade/exceptions');
function findFirstClosedCycle(keys) {
  var res = [];
  for (var i = 0; i < keys.length; ++i) {
    if (collection_1.ListWrapper.contains(res, keys[i])) {
      res.push(keys[i]);
      return res;
    } else {
      res.push(keys[i]);
    }
  }
  return res;
}
function constructResolvingPath(keys) {
  if (keys.length > 1) {
    var reversed = findFirstClosedCycle(collection_1.ListWrapper.reversed(keys));
    var tokenStrs = reversed.map(function(k) {
      return lang_1.stringify(k.token);
    });
    return " (" + tokenStrs.join(' -> ') + ")";
  } else {
    return "";
  }
}
var AbstractProviderError = (function(_super) {
  __extends(AbstractProviderError, _super);
  function AbstractProviderError(injector, key, constructResolvingMessage) {
    _super.call(this, "DI Exception");
    this.keys = [key];
    this.injectors = [injector];
    this.constructResolvingMessage = constructResolvingMessage;
    this.message = this.constructResolvingMessage(this.keys);
  }
  AbstractProviderError.prototype.addKey = function(injector, key) {
    this.injectors.push(injector);
    this.keys.push(key);
    this.message = this.constructResolvingMessage(this.keys);
  };
  Object.defineProperty(AbstractProviderError.prototype, "context", {
    get: function() {
      return this.injectors[this.injectors.length - 1].debugContext();
    },
    enumerable: true,
    configurable: true
  });
  return AbstractProviderError;
})(exceptions_1.BaseException);
exports.AbstractProviderError = AbstractProviderError;
var NoProviderError = (function(_super) {
  __extends(NoProviderError, _super);
  function NoProviderError(injector, key) {
    _super.call(this, injector, key, function(keys) {
      var first = lang_1.stringify(collection_1.ListWrapper.first(keys).token);
      return "No provider for " + first + "!" + constructResolvingPath(keys);
    });
  }
  return NoProviderError;
})(AbstractProviderError);
exports.NoProviderError = NoProviderError;
var CyclicDependencyError = (function(_super) {
  __extends(CyclicDependencyError, _super);
  function CyclicDependencyError(injector, key) {
    _super.call(this, injector, key, function(keys) {
      return "Cannot instantiate cyclic dependency!" + constructResolvingPath(keys);
    });
  }
  return CyclicDependencyError;
})(AbstractProviderError);
exports.CyclicDependencyError = CyclicDependencyError;
var InstantiationError = (function(_super) {
  __extends(InstantiationError, _super);
  function InstantiationError(injector, originalException, originalStack, key) {
    _super.call(this, "DI Exception", originalException, originalStack, null);
    this.keys = [key];
    this.injectors = [injector];
  }
  InstantiationError.prototype.addKey = function(injector, key) {
    this.injectors.push(injector);
    this.keys.push(key);
  };
  Object.defineProperty(InstantiationError.prototype, "wrapperMessage", {
    get: function() {
      var first = lang_1.stringify(collection_1.ListWrapper.first(this.keys).token);
      return "Error during instantiation of " + first + "!" + constructResolvingPath(this.keys) + ".";
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(InstantiationError.prototype, "causeKey", {
    get: function() {
      return this.keys[0];
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(InstantiationError.prototype, "context", {
    get: function() {
      return this.injectors[this.injectors.length - 1].debugContext();
    },
    enumerable: true,
    configurable: true
  });
  return InstantiationError;
})(exceptions_1.WrappedException);
exports.InstantiationError = InstantiationError;
var InvalidProviderError = (function(_super) {
  __extends(InvalidProviderError, _super);
  function InvalidProviderError(provider) {
    _super.call(this, "Invalid provider - only instances of Provider and Type are allowed, got: " + provider.toString());
  }
  return InvalidProviderError;
})(exceptions_1.BaseException);
exports.InvalidProviderError = InvalidProviderError;
var NoAnnotationError = (function(_super) {
  __extends(NoAnnotationError, _super);
  function NoAnnotationError(typeOrFunc, params) {
    _super.call(this, NoAnnotationError._genMessage(typeOrFunc, params));
  }
  NoAnnotationError._genMessage = function(typeOrFunc, params) {
    var signature = [];
    for (var i = 0,
        ii = params.length; i < ii; i++) {
      var parameter = params[i];
      if (lang_1.isBlank(parameter) || parameter.length == 0) {
        signature.push('?');
      } else {
        signature.push(parameter.map(lang_1.stringify).join(' '));
      }
    }
    return "Cannot resolve all parameters for " + lang_1.stringify(typeOrFunc) + "(" + signature.join(', ') + "). " + 'Make sure they all have valid type or annotations.';
  };
  return NoAnnotationError;
})(exceptions_1.BaseException);
exports.NoAnnotationError = NoAnnotationError;
var OutOfBoundsError = (function(_super) {
  __extends(OutOfBoundsError, _super);
  function OutOfBoundsError(index) {
    _super.call(this, "Index " + index + " is out-of-bounds.");
  }
  return OutOfBoundsError;
})(exceptions_1.BaseException);
exports.OutOfBoundsError = OutOfBoundsError;
var MixingMultiProvidersWithRegularProvidersError = (function(_super) {
  __extends(MixingMultiProvidersWithRegularProvidersError, _super);
  function MixingMultiProvidersWithRegularProvidersError(provider1, provider2) {
    _super.call(this, "Cannot mix multi providers and regular providers, got: " + provider1.toString() + " " + provider2.toString());
  }
  return MixingMultiProvidersWithRegularProvidersError;
})(exceptions_1.BaseException);
exports.MixingMultiProvidersWithRegularProvidersError = MixingMultiProvidersWithRegularProvidersError;
