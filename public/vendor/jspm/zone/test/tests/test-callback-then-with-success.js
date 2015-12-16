require('../common.js');

test.expect(3);

var zoneFunc = function() {
  this.return(1, 2, 3);
};

var successCb = function onSuccess(a, b, c) {
  test.strictEqual(a, 1);
  test.strictEqual(b, 2);
  test.strictEqual(c, 3);
  test.done();
};

var errorCb = function onError(err) {
  test.fail();
};

zone.create(zoneFunc).then(successCb, errorCb);
