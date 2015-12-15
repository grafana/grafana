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
var tryCatch_1 = require('../util/tryCatch');
var errorObject_1 = require('../util/errorObject');
function count(predicate) {
  return this.lift(new CountOperator(predicate, this));
}
exports.count = count;
var CountOperator = (function() {
  function CountOperator(predicate, source) {
    this.predicate = predicate;
    this.source = source;
  }
  CountOperator.prototype.call = function(subscriber) {
    return new CountSubscriber(subscriber, this.predicate, this.source);
  };
  return CountOperator;
})();
var CountSubscriber = (function(_super) {
  __extends(CountSubscriber, _super);
  function CountSubscriber(destination, predicate, source) {
    _super.call(this, destination);
    this.predicate = predicate;
    this.source = source;
    this.count = 0;
    this.index = 0;
  }
  CountSubscriber.prototype._next = function(value) {
    var predicate = this.predicate;
    var passed = true;
    if (predicate) {
      passed = tryCatch_1.tryCatch(predicate)(value, this.index++, this.source);
      if (passed === errorObject_1.errorObject) {
        this.destination.error(passed.e);
        return;
      }
    }
    if (passed) {
      this.count += 1;
    }
  };
  CountSubscriber.prototype._complete = function() {
    this.destination.next(this.count);
    this.destination.complete();
  };
  return CountSubscriber;
})(Subscriber_1.Subscriber);
