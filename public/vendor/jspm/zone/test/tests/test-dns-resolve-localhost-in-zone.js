require('../common.js');

var dns = require('dns');

test.expect(3);
zone.create(function ChildZone() {
  var childZone = zone;
  var async = false;

  dns.resolve('localhost', function(err, addresses) {
    if (err)
      throw err;

    test.ok(typeof addresses === 'object');
    test.ok(zone === childZone);
    test.ok(async);
  });

  async = true;

}).then(function() { test.done(); });
