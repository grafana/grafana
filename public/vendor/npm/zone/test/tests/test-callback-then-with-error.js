require('../common.js');

test.expect(1);

var zoneFunc = function() {
  throw new Error();
};

var successCb = function onSuccess() {
  test.fail();
};

var errorCb = function onError(err) {
  test.ok(err instanceof Error);
  test.done();
};

zone.create(zoneFunc).then(successCb, errorCb);
