require('../common.js');

var execFile = require('child_process').execFile;

test.expect(2);
var zoneFunc = function ExecFileZone() {
  execFile('inv$alid~file', [], callback);

  function callback(err, stdout, stderr) {
    test.ok(zone === execFileZone);
    throw err;
  }
};

var errorFunc = function(err) {
  test.strictEqual(err.code, 'ENOENT');
  test.done();
};

var execFileZone = zone.create(zoneFunc).catch (errorFunc);
