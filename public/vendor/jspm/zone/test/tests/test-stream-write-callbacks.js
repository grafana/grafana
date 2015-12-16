require('../common.js');

test.expect(3);

var net = require('net');

zone.create(function TestZone() {
  var server = net.createServer(function(conn) {
    var zone1 = zone.create(function Zone1() {
      var afterWrite = function afterWrite() {
        test.ok(zone === zone1);
      };

      conn.write('small', afterWrite);
    });

    var zone2 = zone.create(function Zone2() {
      var afterWrite = function afterWrite() {
        test.ok(zone === zone2);
      };

      var string = new Array(1024 * 1024).join('x');
      conn.write(string, afterWrite);
    });

    var zone3 = zone.create(function Zone3() {
      var afterEnd = function afterEnd() {
        test.ok(zone === zone3);
      };

      var buf = new Buffer(1024 * 1024);
      buf.fill(42);
      conn.end(buf, afterEnd);
    });

    process._rawDebug('closing server');
    server.close();
  });

  server.listen(0);

  var conn = net.connect(server.address().port);
  conn.resume();

}).then(function() {
  console.log('all done');
  test.done();
});
