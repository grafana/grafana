require('../common.js');

test.expect(6);

var beforeHook = function() {
  test.equal(zone.name, 'ChildZone');
  test.ok(true, 'expecting a call');
  throw new Error('expected error');
};

var failureCb = function(err) {
  test.ok(zone === zone.root);
  test.ok(/expected/.test(err));
  test.done();
};

var childZone = zone.create(function ChildZone() {
  test.equal(global.zone.name, 'ChildZone');
  test.ok(test, 'running the main function');
}, {beforeTask: beforeHook, errorCallback: failureCb});
