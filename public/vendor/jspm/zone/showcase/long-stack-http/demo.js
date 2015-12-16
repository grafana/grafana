require('../../').enable(); // enable zones

var http = require('http');
var util = require('util');
var url = require('url');
var Zone = zone.Zone;
Zone.longStackSupport = true;

// Server

// Create the server in a separate zone.
var serverZone = zone.create(function ServerZone() {
  var incomingRequestCount = 0;

  // Create an http server that listens on port 3000. Further down this in file
  // this server is hammered with requests.
  var server = http.createServer(function(req, res) {

    // Put the request handling within a zone. Note that the request and
    // response objects are not created within this zone - they're created in
    // the zone where the server lives - but the event listeners do live in the
    // IncomingZone.
    zone.create(function IncomingZone() {

      // Every time we receive some http POST data, reply with a simple
      // message.
      req.on('data', function() {
        // Chaos monkey: destroy the underlying connection at random.
        if (Math.random() < 0.05)
          req.connection.destroy();

        // If the chaos monkey left us alone, send something back.
        res.write('ok thanks buddy!');
      });

      // After the stream of incoming data has ended, end the response too.
      req.on('end', function() {
        res.end();

        // Zone.return() tells the IncomingZone that it is time to gracefully
        // exit. This will clean up the event listeners in this zone.
        zone.return();
      });

      // The incoming request is not expected to fail, but in case an error
      // does happen we just blow up this zone so it cleans itself up.
      req.on('error', function(err) {
        throw err;
      });

    }).catch (function(err) {
      // If an error happened in IncomingZone the things created in that zone
      // are cleaned up by now. However the request and response objects
      // originate from the server zone and we don't want that to crash. So
      // We clean up by sending a 500 error message. Note that writeHead()
      // and end() could throw, so we wrap this in an ordinary try-catch block
      // so the server zone doesn't blow up.
      try {
        res.writeHead(500);
        res.end();
      } catch (err) { }

      // Log the zone stach of the client error.
      console.error(err.zoneStack + '\n');
    });

    // The client only sends 10 requests, and we don't want the demo app to
    // "hang" after the interesting part is over. Therefore, close the server
    // after we've seen all demo-related requests.
    if (++incomingRequestCount === 10)
      server.close();

  }).listen(3000);
});

// Clients

// Create a separate zone to host all request zones.
zone.create(function ClientZone() {

  function RequestZone() {
    // Set up the options for the http client.
    var options = {
      method: 'POST',
      protocol: 'http:',
      hostname: '127.0.0.1',
      port: 3000,
      pathname: '/hello/' + i
    };

    // Set the zone name so the error stack is descriptive.
    this.name = 'POST ' + url.format(options);

    // Do the actual http POST request.
    var req = http.request(options);

    // As part of the POST request, send "hello there" 100 times with a
    // 1ms interval in between.
    var helloCount = 0;
    var helloInterval = setInterval(function() {
      // If we haven't written 100 hellos yes, write another.
      if (helloCount++ < 100)
        return void req.write('hello there!\n');

      // After writing hello 100 times, clear the interval and end the
      // request.
      clearInterval(helloInterval);
      req.end();
    }, 1);

  }
  
  function ErrorHandler(err) {
    // Print the failure stack but don't blow up the process.
    console.error(err.zoneStack + '\n');
  }

  // Create 10 clients that communicate with the server. The server has a
  // chaos monkey running around that randomly makes requests fail.
  for (var i = 0; i < 10; i++) {
    // Create a new zone for every individual request. This isolates connection
    // errors allowing us to handle then and log a useful stack trace for them.
    zone.create(RequestZone).catch (ErrorHandler);
  }
});
