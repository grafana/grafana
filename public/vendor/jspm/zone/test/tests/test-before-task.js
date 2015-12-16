require('../common.js');

var beforeHook = function() { test.ok(true, 'expecting a call'); };

zone.create(function() { test.ok(test, 'running the main function'); },
            {beforeTask: beforeHook});
