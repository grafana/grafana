require('../../').enable(); // enable zones

var Zone = zone.Zone;
var net = require('net');


zone.create(function ServerZone() {
  var server = net.createServer(function(conn) {
    conn.resume();
  });

  server.listen(3000);
});

function ConnectionZone() {
  var conn = net.connect(3000, function() {
    zone.create(function IntervalZone() {
      setInterval(function() {
        conn.write('hello');
      }, 1);
    });
  });
}

for (var i = 0; i < 10; i++) {
  zone.create(ConnectionZone);
}

console.log("Run the inspect tool to see what's going on in this process.");
