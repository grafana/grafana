/* */ 
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Subscriber_1 = require('../Subscriber');
function mapTo(value) {
  return this.lift(new MapToOperator(value));
}
exports.mapTo = mapTo;
var MapToOperator = (function() {
  function MapToOperator(value) {
    this.value = value;
  }
  MapToOperator.prototype.call = function(subscriber) {
    return new MapToSubscriber(subscriber, this.value);
  };
  return MapToOperator;
})();
var MapToSubscriber = (function(_super) {
  __extends(MapToSubscriber, _super);
  function MapToSubscriber(destination, value) {
    _super.call(this, destination);
    this.value = value;
  }
  MapToSubscriber.prototype._next = function(x) {
    this.destination.next(this.value);
  };
  return MapToSubscriber;
})(Subscriber_1.Subscriber);
