require('../common.js');

var spawn = require('child_process').spawn;

test.expect(4);
var zoneFunc = function SpawnZone() {
  function onClose(code, signal) { test.ok(true); }

  var p = spawn('cat', ['-']);
  p.on('close', onClose);

  setTimeout(function() {
    test.ok(zone === spawnZone);
    throw new Error('expected error');
  });
};
var cb = function(err) {
  test.ok(zone === zone.root);
  test.ok(/expected/.test(err));
  test.done();
};
var spawnZone = zone.create(zoneFunc).catch (cb);
