/* */ 
var isScheduler_1 = require('../util/isScheduler');
var fromArray_1 = require('../observable/fromArray');
var mergeAll_support_1 = require('./mergeAll-support');
function concat() {
  var observables = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    observables[_i - 0] = arguments[_i];
  }
  var args = observables;
  args.unshift(this);
  var scheduler = null;
  if (isScheduler_1.isScheduler(args[args.length - 1])) {
    scheduler = args.pop();
  }
  return new fromArray_1.ArrayObservable(args, scheduler).lift(new mergeAll_support_1.MergeAllOperator(1));
}
exports.concat = concat;
