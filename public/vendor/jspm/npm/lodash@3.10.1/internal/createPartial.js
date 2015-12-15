/* */ 
var createWrapper = require('./createWrapper'),
    replaceHolders = require('./replaceHolders'),
    restParam = require('../function/restParam');
function createPartial(flag) {
  var partialFunc = restParam(function(func, partials) {
    var holders = replaceHolders(partials, partialFunc.placeholder);
    return createWrapper(func, flag, undefined, partials, holders);
  });
  return partialFunc;
}
module.exports = createPartial;
