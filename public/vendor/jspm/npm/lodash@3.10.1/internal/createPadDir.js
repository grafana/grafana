/* */ 
var baseToString = require('./baseToString'),
    createPadding = require('./createPadding');
function createPadDir(fromRight) {
  return function(string, length, chars) {
    string = baseToString(string);
    return (fromRight ? string : '') + createPadding(string, length, chars) + (fromRight ? '' : string);
  };
}
module.exports = createPadDir;
