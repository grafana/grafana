/* */ 
var combineLatest_support_1 = require('./combineLatest-support');
function combineAll(project) {
  return this.lift(new combineLatest_support_1.CombineLatestOperator(project));
}
exports.combineAll = combineAll;
