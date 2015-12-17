// Normally this would be: require('zone').enable();
require('../../').enable();

var Zone = zone.Zone;
Zone.longStackSupport = true;

zone.create(function Outer() {
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
