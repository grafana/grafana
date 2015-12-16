require('../common.js');

test.expect(2);
var afterHook = function() { test.ok(true, 'expecting a call'); };

zone.create(function() { test.ok(test, 'running the main function'); },
            {afterTask: afterHook});
test.done();
