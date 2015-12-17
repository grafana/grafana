require('../common.js');

var dns = require('dns');

test.expect(2);
zone.create(function ChildZone() {
  var childZone = zone;

  dns.resolve6('www.strongloop.com', function(err, addresses) {
    if (err) {
      throw err;
    }
    test.ok(typeof addresses === 'object');
    test.ok(zone === childZone);
  });
}).then(function() { test.done(); });
