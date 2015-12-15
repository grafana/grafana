/* */ 
var isError = require('../lang/isError'),
    restParam = require('../function/restParam');
var attempt = restParam(function(func, args) {
  try {
    return func.apply(undefined, args);
  } catch (e) {
    return isError(e) ? e : new Error(e);
  }
});
module.exports = attempt;
