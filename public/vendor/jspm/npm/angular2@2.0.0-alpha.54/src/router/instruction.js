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
var collection_1 = require('../facade/collection');
var lang_1 = require('../facade/lang');
var async_1 = require('../facade/async');
var RouteParams = (function() {
  function RouteParams(params) {
    this.params = params;
  }
  RouteParams.prototype.get = function(param) {
    return lang_1.normalizeBlank(collection_1.StringMapWrapper.get(this.params, param));
  };
  return RouteParams;
})();
exports.RouteParams = RouteParams;
var RouteData = (function() {
  function RouteData(data) {
    if (data === void 0) {
      data = lang_1.CONST_EXPR({});
    }
    this.data = data;
  }
  RouteData.prototype.get = function(key) {
    return lang_1.normalizeBlank(collection_1.StringMapWrapper.get(this.data, key));
  };
  return RouteData;
})();
exports.RouteData = RouteData;
exports.BLANK_ROUTE_DATA = new RouteData();
var Instruction = (function() {
  function Instruction() {
    this.auxInstruction = {};
  }
  Object.defineProperty(Instruction.prototype, "urlPath", {
    get: function() {
      return this.component.urlPath;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Instruction.prototype, "urlParams", {
    get: function() {
      return this.component.urlParams;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Instruction.prototype, "specificity", {
    get: function() {
      var total = 0;
      if (lang_1.isPresent(this.component)) {
        total += this.component.specificity;
      }
      if (lang_1.isPresent(this.child)) {
        total += this.child.specificity;
      }
      return total;
    },
    enumerable: true,
    configurable: true
  });
  Instruction.prototype.toRootUrl = function() {
    return this.toUrlPath() + this.toUrlQuery();
  };
  Instruction.prototype._toNonRootUrl = function() {
    return this._stringifyPathMatrixAuxPrefixed() + (lang_1.isPresent(this.child) ? this.child._toNonRootUrl() : '');
  };
  Instruction.prototype.toUrlQuery = function() {
    return this.urlParams.length > 0 ? ('?' + this.urlParams.join('&')) : '';
  };
  Instruction.prototype.replaceChild = function(child) {
    return new ResolvedInstruction(this.component, child, this.auxInstruction);
  };
  Instruction.prototype.toUrlPath = function() {
    return this.urlPath + this._stringifyAux() + (lang_1.isPresent(this.child) ? this.child._toNonRootUrl() : '');
  };
  Instruction.prototype.toLinkUrl = function() {
    return this.urlPath + this._stringifyAux() + (lang_1.isPresent(this.child) ? this.child._toLinkUrl() : '');
  };
  Instruction.prototype._toLinkUrl = function() {
    return this._stringifyPathMatrixAuxPrefixed() + (lang_1.isPresent(this.child) ? this.child._toLinkUrl() : '');
  };
  Instruction.prototype._stringifyPathMatrixAuxPrefixed = function() {
    var primary = this._stringifyPathMatrixAux();
    if (primary.length > 0) {
      primary = '/' + primary;
    }
    return primary;
  };
  Instruction.prototype._stringifyMatrixParams = function() {
    return this.urlParams.length > 0 ? (';' + this.component.urlParams.join(';')) : '';
  };
  Instruction.prototype._stringifyPathMatrixAux = function() {
    if (lang_1.isBlank(this.component)) {
      return '';
    }
    return this.urlPath + this._stringifyMatrixParams() + this._stringifyAux();
  };
  Instruction.prototype._stringifyAux = function() {
    var routes = [];
    collection_1.StringMapWrapper.forEach(this.auxInstruction, function(auxInstruction, _) {
      routes.push(auxInstruction._stringifyPathMatrixAux());
    });
    if (routes.length > 0) {
      return '(' + routes.join('//') + ')';
    }
    return '';
  };
  return Instruction;
})();
exports.Instruction = Instruction;
var ResolvedInstruction = (function(_super) {
  __extends(ResolvedInstruction, _super);
  function ResolvedInstruction(component, child, auxInstruction) {
    _super.call(this);
    this.component = component;
    this.child = child;
    this.auxInstruction = auxInstruction;
  }
  ResolvedInstruction.prototype.resolveComponent = function() {
    return async_1.PromiseWrapper.resolve(this.component);
  };
  return ResolvedInstruction;
})(Instruction);
exports.ResolvedInstruction = ResolvedInstruction;
var DefaultInstruction = (function(_super) {
  __extends(DefaultInstruction, _super);
  function DefaultInstruction(component, child) {
    _super.call(this);
    this.component = component;
    this.child = child;
  }
  DefaultInstruction.prototype.resolveComponent = function() {
    return async_1.PromiseWrapper.resolve(this.component);
  };
  DefaultInstruction.prototype.toLinkUrl = function() {
    return '';
  };
  DefaultInstruction.prototype._toLinkUrl = function() {
    return '';
  };
  return DefaultInstruction;
})(Instruction);
exports.DefaultInstruction = DefaultInstruction;
var UnresolvedInstruction = (function(_super) {
  __extends(UnresolvedInstruction, _super);
  function UnresolvedInstruction(_resolver, _urlPath, _urlParams) {
    if (_urlPath === void 0) {
      _urlPath = '';
    }
    if (_urlParams === void 0) {
      _urlParams = lang_1.CONST_EXPR([]);
    }
    _super.call(this);
    this._resolver = _resolver;
    this._urlPath = _urlPath;
    this._urlParams = _urlParams;
  }
  Object.defineProperty(UnresolvedInstruction.prototype, "urlPath", {
    get: function() {
      if (lang_1.isPresent(this.component)) {
        return this.component.urlPath;
      }
      if (lang_1.isPresent(this._urlPath)) {
        return this._urlPath;
      }
      return '';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(UnresolvedInstruction.prototype, "urlParams", {
    get: function() {
      if (lang_1.isPresent(this.component)) {
        return this.component.urlParams;
      }
      if (lang_1.isPresent(this._urlParams)) {
        return this._urlParams;
      }
      return [];
    },
    enumerable: true,
    configurable: true
  });
  UnresolvedInstruction.prototype.resolveComponent = function() {
    var _this = this;
    if (lang_1.isPresent(this.component)) {
      return async_1.PromiseWrapper.resolve(this.component);
    }
    return this._resolver().then(function(resolution) {
      _this.child = resolution.child;
      return _this.component = resolution.component;
    });
  };
  return UnresolvedInstruction;
})(Instruction);
exports.UnresolvedInstruction = UnresolvedInstruction;
var RedirectInstruction = (function(_super) {
  __extends(RedirectInstruction, _super);
  function RedirectInstruction(component, child, auxInstruction) {
    _super.call(this, component, child, auxInstruction);
  }
  return RedirectInstruction;
})(ResolvedInstruction);
exports.RedirectInstruction = RedirectInstruction;
var ComponentInstruction = (function() {
  function ComponentInstruction(urlPath, urlParams, data, componentType, terminal, specificity, params) {
    if (params === void 0) {
      params = null;
    }
    this.urlPath = urlPath;
    this.urlParams = urlParams;
    this.componentType = componentType;
    this.terminal = terminal;
    this.specificity = specificity;
    this.params = params;
    this.reuse = false;
    this.routeData = lang_1.isPresent(data) ? data : exports.BLANK_ROUTE_DATA;
  }
  return ComponentInstruction;
})();
exports.ComponentInstruction = ComponentInstruction;
