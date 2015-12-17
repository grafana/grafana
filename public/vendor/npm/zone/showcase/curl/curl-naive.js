var http = require('http');

var cache = {};

function curl(url, cb) {
  if (cache[url])
    // WRONG: synchronous callback
    return cb(null, cache[url]);

  var data = '';

  http.get(url, function(res) {
    res.setEncoding('utf8');

    res.on('data', function(s) {
      data += s;
    });

    res.on('end', function() {
      cache[url] = data;
      cb(null, data);
    });

    // WRONG: are you sure that 'end' and 'error' are mutually exclusive?
    res.on('error', function(err) {
      cb(err);
    });
  });

  // WRONG: the request object may emit 'error', but there is no
  // handler for it.
}

// Usage:
curl('http://www.google.com', console.log);
curl('http://does/not/exist/', console.log);
