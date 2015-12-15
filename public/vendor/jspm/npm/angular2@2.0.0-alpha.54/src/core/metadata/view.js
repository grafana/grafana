/* */ 
(function(process) {
  'use strict';
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
  (function(ViewEncapsulation) {
    ViewEncapsulation[ViewEncapsulation["Emulated"] = 0] = "Emulated";
    ViewEncapsulation[ViewEncapsulation["Native"] = 1] = "Native";
    ViewEncapsulation[ViewEncapsulation["None"] = 2] = "None";
  })(exports.ViewEncapsulation || (exports.ViewEncapsulation = {}));
  var ViewEncapsulation = exports.ViewEncapsulation;
  exports.VIEW_ENCAPSULATION_VALUES = [ViewEncapsulation.Emulated, ViewEncapsulation.Native, ViewEncapsulation.None];
  var ViewMetadata = (function() {
    function ViewMetadata(_a) {
      var _b = _a === void 0 ? {} : _a,
          templateUrl = _b.templateUrl,
          template = _b.template,
          directives = _b.directives,
          pipes = _b.pipes,
          encapsulation = _b.encapsulation,
          styles = _b.styles,
          styleUrls = _b.styleUrls;
      this.templateUrl = templateUrl;
      this.template = template;
      this.styleUrls = styleUrls;
      this.styles = styles;
      this.directives = directives;
      this.pipes = pipes;
      this.encapsulation = encapsulation;
    }
    ViewMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object])], ViewMetadata);
    return ViewMetadata;
  })();
  exports.ViewMetadata = ViewMetadata;
})(require('process'));
