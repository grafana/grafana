require('../common.js');

test.expect(1);

var m = require('module');
test.strictEqual(typeof m.Module, 'function');

test.done();
