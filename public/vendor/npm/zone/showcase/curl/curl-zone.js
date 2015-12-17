require('../../').enable();

var Zone = zone.Zone;
Zone.longStackSupport = true;
var http = require('http');

var cache = {};

function curl(url, cb) {
  zone.create(function CurlZone() {
    if (cache[url])
      // A zone always completes asynchronously, as the user would expect,
      // even when it returns a result immediately.
      return zone.return(cache[url]);

    var data = '';

    // Note that we're not installing an 'error' event handler on either the
    // request nor the response object.

    // Any error that happens within the zone is automatically caught and
    // handled. The zone prevents leaking resources, so both the 'request'
    // and the 'response' stream associated with the http.get api will be
    // cleaned up before the zone calls it's callback.

    http.get(url, function(res) {
      res.setEncoding('utf8');

      res.on('data', function(s) {
        data += s;
      });

      res.on('end', function() {
        cache[url] = data;
        zone.return(data);
      });
    });

    // The zone takes an error-first callback that it will always call exactly
    // once - even if due to a programmer error the zone never explicitly
    // returns a result. In this case we're just forwarding to the callback that
    // the user passed when calling curl().
  }).setCallback(cb);
}

// Usage:
curl('http://www.google.com/', console.log);

// This is obviously going to fail, so we print a long stack trace in the
// callback.
curl('http://does/not/exist/', function(err, data) {
  console.log(err.zoneStack);
});
