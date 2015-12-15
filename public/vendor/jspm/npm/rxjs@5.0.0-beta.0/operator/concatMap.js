/* */ 
var mergeMap_support_1 = require('./mergeMap-support');
function concatMap(project, projectResult) {
  return this.lift(new mergeMap_support_1.MergeMapOperator(project, projectResult, 1));
}
exports.concatMap = concatMap;
