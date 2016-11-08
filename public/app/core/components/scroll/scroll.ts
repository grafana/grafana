// ///<reference path="../../headers/common.d.ts" />
//
// import _ from 'lodash';
//
// var objectAssign = require('object-assign');
// var Emitter = require('tiny-emitter');
// var Lethargy = require('lethargy').Lethargy;
// var support = require('./support');
// var clone = require('./clone');
// var bindAll = require('bindall-standalone');
// var EVT_ID = 'virtualscroll';
//
// var keyCodes = {
//     LEFT: 37,
//     UP: 38,
//     RIGHT: 39,
//     DOWN: 40
// };
//
// function VirtualScroll(this: any, options) {
//     _.bindAll(this, '_onWheel', '_onMouseWheel', '_onTouchStart', '_onTouchMove', '_onKeyDown');
//
//     this.el = window;
//     if (options && options.el) {
//         this.el = options.el;
//         delete options.el;
//     }
//
//     this.options = _.assign({
//         mouseMultiplier: 1,
//         touchMultiplier: 2,
//         firefoxMultiplier: 15,
//         keyStep: 120,
//         preventTouch: false,
//         unpreventTouchClass: 'vs-touchmove-allowed',
//         limitInertia: false
//     }, options);
//
//     if (this.options.limitInertia) this._lethargy = new Lethargy();
//
//     this._emitter = new Emitter();
//     this._event = {
//         y: 0,
//         x: 0,
//         deltaX: 0,
//         deltaY: 0
//     };
//
//     this.touchStartX = null;
//     this.touchStartY = null;
//     this.bodyTouchAction = null;
// }
//
// VirtualScroll.prototype._notify = function(e) {
//     var evt = this._event;
//     evt.x += evt.deltaX;
//     evt.y += evt.deltaY;
//
//    this._emitter.emit(EVT_ID, {
//         x: evt.x,
//         y: evt.y,
//         deltaX: evt.deltaX,
//         deltaY: evt.deltaY,
//         originalEvent: e
//    });
// };
//
// VirtualScroll.prototype._onWheel = function(e) {
//     var options = this.options;
//     if (this._lethargy && this._lethargy.check(e) === false) return;
//
//     var evt = this._event;
//
//     // In Chrome and in Firefox (at least the new one)
//     evt.deltaX = e.wheelDeltaX || e.deltaX * -1;
//     evt.deltaY = e.wheelDeltaY || e.deltaY * -1;
//
//     // for our purpose deltamode = 1 means user is on a wheel mouse, not touch pad
//     // real meaning: https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent#Delta_modes
//     if(support.isFirefox && e.deltaMode == 1) {
//         evt.deltaX *= options.firefoxMultiplier;
//         evt.deltaY *= options.firefoxMultiplier;
//     }
//
//     evt.deltaX *= options.mouseMultiplier;
//     evt.deltaY *= options.mouseMultiplier;
//
//     this._notify(e);
// };
//
// VirtualScroll.prototype._onMouseWheel = function(e) {
//     if (this.options.limitInertia && this._lethargy.check(e) === false) return;
//
//     var evt = this._event;
//
//     // In Safari, IE and in Chrome if 'wheel' isn't defined
//     evt.deltaX = (e.wheelDeltaX) ? e.wheelDeltaX : 0;
//     evt.deltaY = (e.wheelDeltaY) ? e.wheelDeltaY : e.wheelDelta;
//
//     this._notify(e);
// };
//
// VirtualScroll.prototype._onTouchStart = function(e) {
//     var t = (e.targetTouches) ? e.targetTouches[0] : e;
//     this.touchStartX = t.pageX;
//     this.touchStartY = t.pageY;
// };
//
// VirtualScroll.prototype._onTouchMove = function(e) {
//     var options = this.options;
//     if(options.preventTouch
//         && !e.target.classList.contains(options.unpreventTouchClass)) {
//         e.preventDefault();
//     }
//
//     var evt = this._event;
//
//     var t = (e.targetTouches) ? e.targetTouches[0] : e;
//
//     evt.deltaX = (t.pageX - this.touchStartX) * options.touchMultiplier;
//     evt.deltaY = (t.pageY - this.touchStartY) * options.touchMultiplier;
//
//     this.touchStartX = t.pageX;
//     this.touchStartY = t.pageY;
//
//     this._notify(e);
// };
//
// VirtualScroll.prototype._onKeyDown = function(e) {
//     var evt = this._event;
//     evt.deltaX = evt.deltaY = 0;
//
//     switch(e.keyCode) {
//         case keyCodes.LEFT:
//         case keyCodes.UP:
//             evt.deltaY = this.options.keyStep;
//             break;
//
//         case keyCodes.RIGHT:
//         case keyCodes.DOWN:
//             evt.deltaY = - this.options.keyStep;
//             break;
//
//         default:
//             return;
//     }
//
//     this._notify(e);
// };
//
// VirtualScroll.prototype._bind = function() {
//     if(support.hasWheelEvent) this.el.addEventListener('wheel', this._onWheel);
//     if(support.hasMouseWheelEvent) this.el.addEventListener('mousewheel', this._onMouseWheel);
//
//     if(support.hasTouch) {
//         this.el.addEventListener('touchstart', this._onTouchStart);
//         this.el.addEventListener('touchmove', this._onTouchMove);
//     }
//
//     if(support.hasPointer && support.hasTouchWin) {
//         this.bodyTouchAction = document.body.style.msTouchAction;
//         document.body.style.msTouchAction = 'none';
//         this.el.addEventListener('MSPointerDown', this._onTouchStart, true);
//         this.el.addEventListener('MSPointerMove', this._onTouchMove, true);
//     }
//
//     if(support.hasKeyDown) document.addEventListener('keydown', this._onKeyDown);
// };
//
// VirtualScroll.prototype._unbind = function() {
//     if(support.hasWheelEvent) this.el.removeEventListener('wheel', this._onWheel);
//     if(support.hasMouseWheelEvent) this.el.removeEventListener('mousewheel', this._onMouseWheel);
//
//     if(support.hasTouch) {
//         this.el.removeEventListener('touchstart', this._onTouchStart);
//         this.el.removeEventListener('touchmove', this._onTouchMove);
//     }
//
//     if(support.hasPointer && support.hasTouchWin) {
//         document.body.style.msTouchAction = this.bodyTouchAction;
//         this.el.removeEventListener('MSPointerDown', this._onTouchStart, true);
//         this.el.removeEventListener('MSPointerMove', this._onTouchMove, true);
//     }
//
//     if(support.hasKeyDown) document.removeEventListener('keydown', this._onKeyDown);
// };
//
// VirtualScroll.prototype.on = function(cb, ctx) {
//   this._emitter.on(EVT_ID, cb, ctx);
//
//   var events = this._emitter.e;
//   if (events && events[EVT_ID] && events[EVT_ID].length === 1) this._bind();
// };
//
// VirtualScroll.prototype.off = function(cb, ctx) {
//   this._emitter.off(EVT_ID, cb, ctx);
//
//   var events = this._emitter.e;
//   if (!events[EVT_ID] || events[EVT_ID].length <= 0) this._unbind();
// };
//
// VirtualScroll.prototype.reset = function() {
//     var evt = this._event;
//     evt.x = 0;
//     evt.y = 0;
// };
//
// VirtualScroll.prototype.destroy = function() {
//     this._emitter.off();
//     this._unbind();
// };
