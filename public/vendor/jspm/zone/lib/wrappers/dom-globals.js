var realSetTimeout = global.setTimeout;
var realClearTimeout = global.clearTimeout;

global.setTimeout = function setTimeout(cb, timeout) {
  var options = {
    autoRelease: true,
    signalCallback:
        function(err) {
          if (err || timeout === 0) {
            this.release();
          }
        },
    releaseCallback: function() { realClearTimeout(handle); },
    name: 'setTimeout'
  };

  var callback = zone.bindCallback(null, cb, null, options);
  var handle = realSetTimeout(callback, timeout);

  return callback;
};

global.clearTimeout =
    function clearTimeout(callback) { zone.releaseCallback(callback); };

var realSetInterval = global.setInterval;
var realClearInterval = global.clearInterval;

global.setInterval = function setInterval(cb, interval) {
  var options = {
    autoRelease: false,
    signalCallback: function(err) { this.release(); },
    releaseCallback:
        function() {
          // Calling realClearTimeout may seem wrong here but it is in fact
          // intentional.
          handle._repeat = false;
          realClearTimeout(handle);
        },
    name: 'setInterval'
  };

  var callback = zone.bindCallback(null, cb, null, options);
  var handle = realSetInterval(callback, interval);

  return callback;
};

global.clearInterval =
    function clearInterval(callback) { zone.releaseCallback(callback); };

var realSetImmediate = global.setImmediate;
var realClearImmediate = global.clearImmediate;

global.setImmediate = function setImmediate(cb, timeout) {
  var options = {
    autoRelease: false,
    signalCallback: function(err) { this.release(); },
    releaseCallback: function() { realClearImmediate(handle); },
    name: 'setImmediate'
  };

  var callback = zone.bindCallback(null, cb, null, options);
  var handle = realSetImmediate(callback, timeout);

  return callback;
};

global.clearImmediate =
    function clearImmediate(callback) { zone.releaseCallback(callback); };
