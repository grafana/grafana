/* */ 
var chain = require('./chain');
function wrapperChain() {
  return chain(this);
}
module.exports = wrapperChain;
