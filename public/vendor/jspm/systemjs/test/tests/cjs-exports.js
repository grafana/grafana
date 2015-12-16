module.exports = F;
require('./cjs-exports-dep.js');
function F() {
  return 'export';
}
module.exports = require('./cjs-exports-dep.js');