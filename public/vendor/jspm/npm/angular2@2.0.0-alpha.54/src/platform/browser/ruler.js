/* */ 
'use strict';
var async_1 = require('../../facade/async');
var Rectangle = (function() {
  function Rectangle(left, top, width, height) {
    this.left = left;
    this.right = left + width;
    this.top = top;
    this.bottom = top + height;
    this.height = height;
    this.width = width;
  }
  return Rectangle;
})();
exports.Rectangle = Rectangle;
var Ruler = (function() {
  function Ruler(domAdapter) {
    this.domAdapter = domAdapter;
  }
  Ruler.prototype.measure = function(el) {
    var clntRect = this.domAdapter.getBoundingClientRect(el.nativeElement);
    return async_1.PromiseWrapper.resolve(new Rectangle(clntRect.left, clntRect.top, clntRect.width, clntRect.height));
  };
  return Ruler;
})();
exports.Ruler = Ruler;
