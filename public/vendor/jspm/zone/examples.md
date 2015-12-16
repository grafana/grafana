## Examples

### Zones and express

This example show a very simple case where Zones can:
  
  * Store user provided data with different lifetimes
  * Capture unexpected Exceptions in asynchronous callbacks  
  * Provide a long stack-trace of exceptions

Example code:
```js
require('zone').enable();
express = require('express');
var Zone = zone.Zone;

var app = express();
var router = express.Router();
Zone.longStackSupport = true;

//Initialize the Request id in the root zone. 
//This value will be  available to all child zones.
zone.data.requestId = 0;

app.use(function(req, res, next) {
  //Increment the request ID for every new request
  ++zone.data.requestId;

  //Create a new Zone for this request
  zone.create(
           function RequestZone() {
             //Store the request URL in the Request zone
             //This value will be only to this zone and its children
             zone.data.requestURL = req.url;
             
             //Continue to run other express middleware within this child zone
             next();
           })
      .then(
          //The call was succesful
          function successCallback(err) {
            res.write('Transaction succesful\n');
            res.end();
          },
          
          //An error was thrown while processing this request
          function errorCallback(err) {
            res.write('Transaction failed\n');
            res.write('x' + err.zoneStack + '\n');
            res.end();
          });
});

router.get('/', function(req, res) {
  if (Math.random() > 0.5) {
    //Simulate some async I/O call that throws an exception
    process.nextTick(function() { throw new Error("monkey wrench"); });
  }
  
  res.write('Running request #' + zone.data.requestId + ' within zone: ' +
            zone.name + ' (URL:' + zone.data.requestURL + ')\n');
});

app.use('/', router);
app.listen(3001);
```

Output:
```sh
> curl localhost:3001?q=ghi
Running request #3 within zone: RequestZone (URL:/?q=ghi)
Transaction failed
xError: monkey wrench
    at Zone.<anonymous> (/scratch/server.js:44:41)
    at Zone._apply (/scratch/node_modules/zone/lib/zone.js:588:15)
    at Zone.apply (/scratch/node_modules/zone/lib/zone.js:611:23)
    at processCallbacks (/scratch/node_modules/zone/lib/scheduler.js:47:10)
    at processQueues (/scratch/node_modules/zone/lib/scheduler.js:67:5)
    at process._tickCallback (node.js:343:11)
In zone: RequestZone
    at Zone.create (/scratch/node_modules/zone/lib/zone.js:273:10)
    at Layer.handle (/scratch/server.js:17:8)
    at trim_prefix (/scratch/node_modules/express/lib/router/index.js:226:17)
    at /scratch/node_modules/express/lib/router/index.js:198:9
    at Function.proto.process_params (/scratch/node_modules/express/lib/router/index.js:251:12)
    at next (/scratch/node_modules/express/lib/router/index.js:189:19)
    at Layer.expressInit [as handle] (/scratch/node_modules/express/lib/middleware/init.js:23:5)
    at trim_prefix (/scratch/node_modules/express/lib/router/index.js:226:17)
    at /scratch/node_modules/express/lib/router/index.js:198:9
    at Function.proto.process_params (/scratch/node_modules/express/lib/router/index.js:251:12)
    
> curl localhost:3001?q=klm
Running request #4 within zone: RequestZone (URL:/?q=klm)
Transaction succesful

```

### Inspecting a running application

This showcase demonstrates what the _inspect_ tool does.

__demo.js__: 

The demo script spins up a TCP server and creates a bunch of clients that send data to the server on an interval basis.

```javascript
require('zone').enable(); // enable zones

var Zone = zone.Zone;
var net = require('net');

Zone.longStackSupport = true;

zone.create(function ServerZone() {
  var server = net.createServer(function(conn) {
    conn.resume();
  });

  server.listen(3001);
});


for (var i = 0; i < 10; i++) {
  zone.create(function ConnectionZone() {
    var conn = net.connect(3001, function() {
      zone.create(function IntervalZone() {
        setInterval(function() {
          conn.write('hello');
        }, 1);
      });
    });
  });
}

console.log("Run the inspect tool to see what's going on in this process.");
```

__inspect.js__

The inspect tool outputs a snapshot of all the asynchronous action
going on inside all node processes using zones. It also displays
resources (like sockets and file descriptors) that by themselves do not
represent future events, but are relevant to zones because these
resources are automatically cleaned up when the zone returns or throws.

The output looks like a tree, because zones act as containers for
asynchronous I/O and related resources.

Entries marked with a `+` are active sources of events that are running
inside the zone. Entries not marked with a plus sign are passive
resources that don't produce callbacks, but that are cleanup up when a
zone returns or throws.

```javascript
var isWindows = process.platform === 'win32';
var fs = require('fs');
var net = require('net');
var path = require('path');
var prefix = isWindows ? '\\\\?\\pipe'
                       : '/tmp';


var pipeNames = fs.readdirSync(prefix);

pipeNames = pipeNames.filter(function(name) {
  return /^%node-zone-debug-/.test(name);
}).map(function(name) {
  return prefix + path.sep + name;
});

if (pipeNames.length > 0)
  inspectNext();
else
  console.log('No zone processes found');


function inspectNext() {
  var pipeName = pipeNames.shift();

  if (!pipeName)
    return;

  var conn = net.connect(pipeName);
  conn.pipe(process.stdout);
  conn.on('error', function() {});
  conn.on('close', inspectNext);
}
```

Output:
```txt
> node inspect.js
(2194) node /Volumes/Aether/Users/kraman/Documents/strongloop/zone.kr/scratch.js
+[Zone        ] #1 Root (64 tasks, 4 external callbacks)
  +[ZoneCallback] #14 OnRead
  +[ZoneCallback] #15 OnWriteComplete
  +[ZoneCallback] #16 OnRead
  +[ZoneCallback] #17 OnWriteComplete
  +[Zone        ] #8 DebugServerZone (7 tasks, 5 external callbacks)
    +[ZoneCallback] #10 OnRead
    +[ZoneCallback] #11 OnWriteComplete
    +[ZoneCallback] #12 OnConnection
    +[ZoneCallback] #181 OnRead
    +[ZoneCallback] #182 OnWriteComplete
     [Stream      ] Pipe server 
     [Stream      ] Pipe handle 
   [Stream      ] TTY handle  (fd: 1)
   [Stream      ] TTY handle  (fd: 2)
  +[Zone        ] #18 ServerZone (23 tasks, 23 external callbacks)
    +[ZoneCallback] #20 OnRead
    +[ZoneCallback] #21 OnWriteComplete
    +[ZoneCallback] #22 OnConnection
     ...
     [Stream      ] TCP server  (:::3001)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53945)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53946)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53947)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53948)
     ...
  +[Zone        ] #23 ConnectionZone (3 tasks, 2 external callbacks)
    +[ZoneCallback] #27 OnRead
    +[ZoneCallback] #28 OnWriteComplete
     [Stream      ] TCP handle  (127.0.0.1:53945 <=> 127.0.0.1:3001)
    +[Zone        ] #153 IntervalZone (1 tasks, 1 external callbacks)
      +[ZoneCallback] #154 setInterval
  +[Zone        ] #31 ConnectionZone (3 tasks, 2 external callbacks)
    +[ZoneCallback] #35 OnRead
    +[ZoneCallback] #36 OnWriteComplete
     [Stream      ] TCP handle  (127.0.0.1:53946 <=> 127.0.0.1:3001)
    +[Zone        ] #155 IntervalZone (1 tasks, 1 external callbacks)
      +[ZoneCallback] #156 setInterval
  ...
```

### Other examples

Other examples are available in the [Zones github repository](https://github.com/strongloop/zone/tree/master/showcase)
