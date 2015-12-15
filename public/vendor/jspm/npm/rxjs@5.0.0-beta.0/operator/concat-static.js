/* */ 
var queue_1 = require('../scheduler/queue');
var mergeAll_support_1 = require('./mergeAll-support');
var fromArray_1 = require('../observable/fromArray');
var isScheduler_1 = require('../util/isScheduler');
function concat() {
  var observables = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    observables[_i - 0] = arguments[_i];
  }
  var scheduler = queue_1.queue;
  var args = observables;
  if (isScheduler_1.isScheduler(args[observables.length - 1])) {
    scheduler = args.pop();
  }
  return new fromArray_1.ArrayObservable(observables, scheduler).lift(new mergeAll_support_1.MergeAllOperator(1));
}
exports.concat = concat;
