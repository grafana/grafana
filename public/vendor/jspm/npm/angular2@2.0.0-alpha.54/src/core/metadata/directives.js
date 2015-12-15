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
var metadata_1 = require('../di/metadata');
var change_detection_1 = require('../change_detection');
var DirectiveMetadata = (function(_super) {
  __extends(DirectiveMetadata, _super);
  function DirectiveMetadata(_a) {
    var _b = _a === void 0 ? {} : _a,
        selector = _b.selector,
        inputs = _b.inputs,
        outputs = _b.outputs,
        properties = _b.properties,
        events = _b.events,
        host = _b.host,
        bindings = _b.bindings,
        providers = _b.providers,
        exportAs = _b.exportAs,
        queries = _b.queries;
    _super.call(this);
    this.selector = selector;
    this._inputs = inputs;
    this._properties = properties;
    this._outputs = outputs;
    this._events = events;
    this.host = host;
    this.exportAs = exportAs;
    this.queries = queries;
    this._providers = providers;
    this._bindings = bindings;
  }
  Object.defineProperty(DirectiveMetadata.prototype, "inputs", {
    get: function() {
      return lang_1.isPresent(this._properties) && this._properties.length > 0 ? this._properties : this._inputs;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DirectiveMetadata.prototype, "properties", {
    get: function() {
      return this.inputs;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DirectiveMetadata.prototype, "outputs", {
    get: function() {
      return lang_1.isPresent(this._events) && this._events.length > 0 ? this._events : this._outputs;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DirectiveMetadata.prototype, "events", {
    get: function() {
      return this.outputs;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DirectiveMetadata.prototype, "providers", {
    get: function() {
      return lang_1.isPresent(this._bindings) && this._bindings.length > 0 ? this._bindings : this._providers;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DirectiveMetadata.prototype, "bindings", {
    get: function() {
      return this.providers;
    },
    enumerable: true,
    configurable: true
  });
  DirectiveMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object])], DirectiveMetadata);
  return DirectiveMetadata;
})(metadata_1.InjectableMetadata);
exports.DirectiveMetadata = DirectiveMetadata;
var ComponentMetadata = (function(_super) {
  __extends(ComponentMetadata, _super);
  function ComponentMetadata(_a) {
    var _b = _a === void 0 ? {} : _a,
        selector = _b.selector,
        inputs = _b.inputs,
        outputs = _b.outputs,
        properties = _b.properties,
        events = _b.events,
        host = _b.host,
        exportAs = _b.exportAs,
        moduleId = _b.moduleId,
        bindings = _b.bindings,
        providers = _b.providers,
        viewBindings = _b.viewBindings,
        viewProviders = _b.viewProviders,
        _c = _b.changeDetection,
        changeDetection = _c === void 0 ? change_detection_1.ChangeDetectionStrategy.Default : _c,
        queries = _b.queries,
        templateUrl = _b.templateUrl,
        template = _b.template,
        styleUrls = _b.styleUrls,
        styles = _b.styles,
        directives = _b.directives,
        pipes = _b.pipes,
        encapsulation = _b.encapsulation;
    _super.call(this, {
      selector: selector,
      inputs: inputs,
      outputs: outputs,
      properties: properties,
      events: events,
      host: host,
      exportAs: exportAs,
      bindings: bindings,
      providers: providers,
      queries: queries
    });
    this.changeDetection = changeDetection;
    this._viewProviders = viewProviders;
    this._viewBindings = viewBindings;
    this.templateUrl = templateUrl;
    this.template = template;
    this.styleUrls = styleUrls;
    this.styles = styles;
    this.directives = directives;
    this.pipes = pipes;
    this.encapsulation = encapsulation;
    this.moduleId = moduleId;
  }
  Object.defineProperty(ComponentMetadata.prototype, "viewProviders", {
    get: function() {
      return lang_1.isPresent(this._viewBindings) && this._viewBindings.length > 0 ? this._viewBindings : this._viewProviders;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(ComponentMetadata.prototype, "viewBindings", {
    get: function() {
      return this.viewProviders;
    },
    enumerable: true,
    configurable: true
  });
  ComponentMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object])], ComponentMetadata);
  return ComponentMetadata;
})(DirectiveMetadata);
exports.ComponentMetadata = ComponentMetadata;
var PipeMetadata = (function(_super) {
  __extends(PipeMetadata, _super);
  function PipeMetadata(_a) {
    var name = _a.name,
        pure = _a.pure;
    _super.call(this);
    this.name = name;
    this._pure = pure;
  }
  Object.defineProperty(PipeMetadata.prototype, "pure", {
    get: function() {
      return lang_1.isPresent(this._pure) ? this._pure : true;
    },
    enumerable: true,
    configurable: true
  });
  PipeMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object])], PipeMetadata);
  return PipeMetadata;
})(metadata_1.InjectableMetadata);
exports.PipeMetadata = PipeMetadata;
var InputMetadata = (function() {
  function InputMetadata(bindingPropertyName) {
    this.bindingPropertyName = bindingPropertyName;
  }
  InputMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [String])], InputMetadata);
  return InputMetadata;
})();
exports.InputMetadata = InputMetadata;
var OutputMetadata = (function() {
  function OutputMetadata(bindingPropertyName) {
    this.bindingPropertyName = bindingPropertyName;
  }
  OutputMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [String])], OutputMetadata);
  return OutputMetadata;
})();
exports.OutputMetadata = OutputMetadata;
var HostBindingMetadata = (function() {
  function HostBindingMetadata(hostPropertyName) {
    this.hostPropertyName = hostPropertyName;
  }
  HostBindingMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [String])], HostBindingMetadata);
  return HostBindingMetadata;
})();
exports.HostBindingMetadata = HostBindingMetadata;
var HostListenerMetadata = (function() {
  function HostListenerMetadata(eventName, args) {
    this.eventName = eventName;
    this.args = args;
  }
  HostListenerMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [String, Array])], HostListenerMetadata);
  return HostListenerMetadata;
})();
exports.HostListenerMetadata = HostListenerMetadata;
