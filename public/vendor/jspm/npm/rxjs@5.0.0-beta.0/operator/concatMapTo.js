/* */ 
var mergeMapTo_support_1 = require('./mergeMapTo-support');
function concatMapTo(observable, projectResult) {
  return this.lift(new mergeMapTo_support_1.MergeMapToOperator(observable, projectResult, 1));
}
exports.concatMapTo = concatMapTo;
