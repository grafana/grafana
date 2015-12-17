require('../common.js');

var dns = require('dns');

test.expect(2);

zone.create(function ChildZone() {
  var childZone = zone;

  dns.lookup('localhost', function(err, address, family) {
    if (err)
      throw err;

    test.ok(typeof address === 'string');
    test.ok(zone === childZone);
  });
}).then(function() {
  test.done();
});
