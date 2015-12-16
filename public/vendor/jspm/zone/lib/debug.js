var isWindows = process.platform === 'win32';
var net = require('net');
var path = require('path');
var prefix = isWindows ? '\\\\?\\pipe' : '/tmp';
var util = require('util');
var Zone = zone.Zone;

zone.create(function DebugServerZone() {
  var pipeName = prefix + path.sep + '%node-zone-debug-' + process.pid;

  var server = net.createServer({allowHalfOpen: true});

  server.listen(pipeName);
  server._handle.unref();

  server.on('connection', function(conn) {
    var header = util.format('(%d) %s\n', process.pid, process.argv.join(' '));
    conn.write(header);

    var root = zone.root;
    if (!root)
      conn.end('No zones.\n\n');
    else
      conn.end(root.dump());
  });
});
