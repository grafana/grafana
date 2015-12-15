/* */ 
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
var di_1 = require('../di');
var lang_1 = require('../../facade/lang');
var exceptions_1 = require('../../facade/exceptions');
var metadata_1 = require('../metadata');
var reflection_1 = require('../reflection/reflection');
function _isPipeMetadata(type) {
  return type instanceof metadata_1.PipeMetadata;
}
var PipeResolver = (function() {
  function PipeResolver() {}
  PipeResolver.prototype.resolve = function(type) {
    var metas = reflection_1.reflector.annotations(di_1.resolveForwardRef(type));
    if (lang_1.isPresent(metas)) {
      var annotation = metas.find(_isPipeMetadata);
      if (lang_1.isPresent(annotation)) {
        return annotation;
      }
    }
    throw new exceptions_1.BaseException("No Pipe decorator found on " + lang_1.stringify(type));
  };
  PipeResolver = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], PipeResolver);
  return PipeResolver;
})();
exports.PipeResolver = PipeResolver;
