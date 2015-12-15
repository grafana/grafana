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
var compiler_1 = require('../core/linker/compiler');
var proto_view_factory_1 = require('../core/linker/proto_view_factory');
var template_compiler_1 = require('./template_compiler');
var di_1 = require('../core/di');
var RuntimeCompiler = (function(_super) {
  __extends(RuntimeCompiler, _super);
  function RuntimeCompiler() {
    _super.apply(this, arguments);
  }
  return RuntimeCompiler;
})(compiler_1.Compiler);
exports.RuntimeCompiler = RuntimeCompiler;
var RuntimeCompiler_ = (function(_super) {
  __extends(RuntimeCompiler_, _super);
  function RuntimeCompiler_(_protoViewFactory, _templateCompiler) {
    _super.call(this, _protoViewFactory);
    this._templateCompiler = _templateCompiler;
  }
  RuntimeCompiler_.prototype.compileInHost = function(componentType) {
    var _this = this;
    return this._templateCompiler.compileHostComponentRuntime(componentType).then(function(compiledHostTemplate) {
      return compiler_1.internalCreateProtoView(_this, compiledHostTemplate);
    });
  };
  RuntimeCompiler_.prototype.clearCache = function() {
    _super.prototype.clearCache.call(this);
    this._templateCompiler.clearCache();
  };
  RuntimeCompiler_ = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [proto_view_factory_1.ProtoViewFactory, template_compiler_1.TemplateCompiler])], RuntimeCompiler_);
  return RuntimeCompiler_;
})(compiler_1.Compiler_);
exports.RuntimeCompiler_ = RuntimeCompiler_;
