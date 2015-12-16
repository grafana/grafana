require('../common.js');

var fs = require('fs');
var resolve = require('path').resolve;

var fileName2 = resolve(__dirname, '../assets', 'file2');
var fd2;

var childZone = function ChildZone2() { fd2 = fs.openSync(fileName2, 'w+'); };
var errorCb = function() {
  assertFileClosed(test, fd2);
  test.done();
};

test.expect(1);
zone.create(childZone).then(errorCb);

function assertFileClosed(test, fd) {
  try {
    fs.fstatSync(fd);
    test.ok(false);
  } catch (err) {
    console.log(err);
    test.strictEqual(err.code, 'EBADF');
  }
}
