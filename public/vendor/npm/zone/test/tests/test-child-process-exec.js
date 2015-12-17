require('../common.js');

var exec = require('child_process').exec;

test.expect(3);
var execZone = zone.create(function ExecZone() {
  exec('echo hello world', callback);

  function callback(err, stdout, stderr) {
    test.ok(zone === execZone);
    test.ok(!err);
    test.ok(/hello world/.test(stdout));
  }
}).then(function() { test.done(); });
