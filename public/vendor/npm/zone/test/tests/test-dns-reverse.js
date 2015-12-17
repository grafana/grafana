require('../common.js');

var dns = require('dns');

test.expect(2);

zone.create(function ChildZone() {
  var childZone = zone;

  dns.reverse('127.0.0.1', function(err, domains) {
    if (err)
      throw err;

    test.ok(typeof domains === 'object');
    test.ok(zone === childZone);
  });
}).then(function() {
  test.done();
});
