/* */ 
var assert = require('assert');
function jsonEqual(a, b) {
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
}
exports.jsonEqual = jsonEqual;
