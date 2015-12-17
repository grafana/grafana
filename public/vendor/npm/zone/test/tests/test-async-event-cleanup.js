require('../common.js');

test.expect(1);

var outer = zone.create(function Outer() {
  process.nextTick(createMiddleZone);
});

function createMiddleZone() {
  zone.create(function() {
    this.name = 'In the middle';
    failAsync(1);
  });
}

var failAsync = zone.define(function AsyncFailZone(timeout) {
  setTimeout(function() {
    function_that_doesnt_exist();
  }, timeout);
});

outer.setCallback(function(err, res) {
  test.ok(err !== null);
  test.done();
});
