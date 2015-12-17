require('../common.js');

var fs = require('fs');
var resolve = require('path').resolve;

var fileName1 = resolve(__dirname, '../assets', 'file1');
var fd1;

var childZone = function ChildZone1() {
  fs.open(fileName1, 'w+', function(err, fd) {
    test.ok(true);

    if (err) throw err;
    fd1 = fd;

    throw new Error('expected error');
  });
};

var errorCb = function(err) {
  test.ok(/expected/.test(err));
  assertFileClosed(test, fd1);
  test.done();
};

test.expect(3);
zone.create(childZone).catch (errorCb);

function assertFileClosed(test, fd) {
  try {
    fs.fstatSync(fd);
    test.ok(false);
  } catch (err) {
    console.log(err);
    test.strictEqual(err.code, 'EBADF');
  }
}
