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
var lang_1 = require('../../../facade/lang');
var exceptions_1 = require('../../../facade/exceptions');
var collection_1 = require('../../../facade/collection');
var di_1 = require('../../di');
var IterableDiffers = (function() {
  function IterableDiffers(factories) {
    this.factories = factories;
  }
  IterableDiffers.create = function(factories, parent) {
    if (lang_1.isPresent(parent)) {
      var copied = collection_1.ListWrapper.clone(parent.factories);
      factories = factories.concat(copied);
      return new IterableDiffers(factories);
    } else {
      return new IterableDiffers(factories);
    }
  };
  IterableDiffers.extend = function(factories) {
    return new di_1.Provider(IterableDiffers, {
      useFactory: function(parent) {
        if (lang_1.isBlank(parent)) {
          throw new exceptions_1.BaseException('Cannot extend IterableDiffers without a parent injector');
        }
        return IterableDiffers.create(factories, parent);
      },
      deps: [[IterableDiffers, new di_1.SkipSelfMetadata(), new di_1.OptionalMetadata()]]
    });
  };
  IterableDiffers.prototype.find = function(iterable) {
    var factory = this.factories.find(function(f) {
      return f.supports(iterable);
    });
    if (lang_1.isPresent(factory)) {
      return factory;
    } else {
      throw new exceptions_1.BaseException("Cannot find a differ supporting object '" + iterable + "'");
    }
  };
  IterableDiffers = __decorate([di_1.Injectable(), lang_1.CONST(), __metadata('design:paramtypes', [Array])], IterableDiffers);
  return IterableDiffers;
})();
exports.IterableDiffers = IterableDiffers;
