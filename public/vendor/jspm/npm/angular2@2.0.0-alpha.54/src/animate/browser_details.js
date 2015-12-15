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
var di_1 = require('../core/di');
var math_1 = require('../facade/math');
var dom_adapter_1 = require('../platform/dom/dom_adapter');
var BrowserDetails = (function() {
  function BrowserDetails() {
    this.elapsedTimeIncludesDelay = false;
    this.doesElapsedTimeIncludesDelay();
  }
  BrowserDetails.prototype.doesElapsedTimeIncludesDelay = function() {
    var _this = this;
    var div = dom_adapter_1.DOM.createElement('div');
    dom_adapter_1.DOM.setAttribute(div, 'style', "position: absolute; top: -9999px; left: -9999px; width: 1px;\n      height: 1px; transition: all 1ms linear 1ms;");
    this.raf(function(timestamp) {
      dom_adapter_1.DOM.on(div, 'transitionend', function(event) {
        var elapsed = math_1.Math.round(event.elapsedTime * 1000);
        _this.elapsedTimeIncludesDelay = elapsed == 2;
        dom_adapter_1.DOM.remove(div);
      });
      dom_adapter_1.DOM.setStyle(div, 'width', '2px');
    }, 2);
  };
  BrowserDetails.prototype.raf = function(callback, frames) {
    if (frames === void 0) {
      frames = 1;
    }
    var queue = new RafQueue(callback, frames);
    return function() {
      return queue.cancel();
    };
  };
  BrowserDetails = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], BrowserDetails);
  return BrowserDetails;
})();
exports.BrowserDetails = BrowserDetails;
var RafQueue = (function() {
  function RafQueue(callback, frames) {
    this.callback = callback;
    this.frames = frames;
    this._raf();
  }
  RafQueue.prototype._raf = function() {
    var _this = this;
    this.currentFrameId = dom_adapter_1.DOM.requestAnimationFrame(function(timestamp) {
      return _this._nextFrame(timestamp);
    });
  };
  RafQueue.prototype._nextFrame = function(timestamp) {
    this.frames--;
    if (this.frames > 0) {
      this._raf();
    } else {
      this.callback(timestamp);
    }
  };
  RafQueue.prototype.cancel = function() {
    dom_adapter_1.DOM.cancelAnimationFrame(this.currentFrameId);
    this.currentFrameId = null;
  };
  return RafQueue;
})();
