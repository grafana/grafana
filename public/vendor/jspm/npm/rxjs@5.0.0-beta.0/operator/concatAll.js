/* */ 
var mergeAll_support_1 = require('./mergeAll-support');
function concatAll() {
  return this.lift(new mergeAll_support_1.MergeAllOperator(1));
}
exports.concatAll = concatAll;
