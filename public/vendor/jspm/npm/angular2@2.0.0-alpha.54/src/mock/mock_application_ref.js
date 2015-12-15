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
var application_ref_1 = require('../core/application_ref');
var di_1 = require('../core/di');
var MockApplicationRef = (function(_super) {
  __extends(MockApplicationRef, _super);
  function MockApplicationRef() {
    _super.apply(this, arguments);
  }
  MockApplicationRef.prototype.registerBootstrapListener = function(listener) {};
  MockApplicationRef.prototype.registerDisposeListener = function(dispose) {};
  MockApplicationRef.prototype.bootstrap = function(componentType, bindings) {
    return null;
  };
  Object.defineProperty(MockApplicationRef.prototype, "injector", {
    get: function() {
      return null;
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(MockApplicationRef.prototype, "zone", {
    get: function() {
      return null;
    },
    enumerable: true,
    configurable: true
  });
  ;
  MockApplicationRef.prototype.dispose = function() {};
  MockApplicationRef.prototype.tick = function() {};
  Object.defineProperty(MockApplicationRef.prototype, "componentTypes", {
    get: function() {
      return null;
    },
    enumerable: true,
    configurable: true
  });
  ;
  MockApplicationRef = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], MockApplicationRef);
  return MockApplicationRef;
})(application_ref_1.ApplicationRef);
exports.MockApplicationRef = MockApplicationRef;
