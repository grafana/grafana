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
var di_1 = require('../core/di');
var ng_zone_1 = require('../core/zone/ng_zone');
var async_1 = require('../facade/async');
var MockNgZone = (function(_super) {
  __extends(MockNgZone, _super);
  function MockNgZone() {
    _super.call(this, {enableLongStackTrace: false});
    this._mockOnEventDone = new async_1.EventEmitter(false);
  }
  Object.defineProperty(MockNgZone.prototype, "onEventDone", {
    get: function() {
      return this._mockOnEventDone;
    },
    enumerable: true,
    configurable: true
  });
  MockNgZone.prototype.run = function(fn) {
    return fn();
  };
  MockNgZone.prototype.runOutsideAngular = function(fn) {
    return fn();
  };
  MockNgZone.prototype.simulateZoneExit = function() {
    async_1.ObservableWrapper.callNext(this.onEventDone, null);
  };
  MockNgZone = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], MockNgZone);
  return MockNgZone;
})(ng_zone_1.NgZone);
exports.MockNgZone = MockNgZone;
