%nativeSource;

var isv010 = require('../../isv010.js');

if (isv010) {
  // Monkey-patch the globalAgent property to always use a single agent in the
  // active zone. The HTTP agent and the HTTP client are so intertwined that it
  // is not practical to share them between zones.

  // This monkey-patch is only applicable to node v0.10;
  // In node 0.11 http.js was split up, our monkey patch mostly lives in
  // _http_agent.js, but see below also.

  zone.root._httpAgent = exports.globalAgent;

  function getAgent() {
    if (zone._httpAgent)
      return zone._httpAgent;

    var agent = new Agent();
    zone._httpAgent = agent;
    return agent;
  }

  function setAgent(agent) {
    zone._httpAgent = agent;
  }

  Object.defineProperty(
      exports,
      'globalAgent',
      { get: getAgent,
        set: setAgent,
        enumerable: true,
        configurable: false });

  // Awkward way of changing the ClientRequest implementation.
  // It is no different than the original one, except for one line.
  var ClientRequestPrototype = ClientRequest.prototype;

  ClientRequest = exports.ClientRequest = function ClientRequest(options, cb) {
    var self = this;
    OutgoingMessage.call(self);

    self.agent = options.agent;
    if (!options.agent && options.agent !== false && !options.createConnection)
      // Zones: this used to be `self.agent = globalAgent`.
      self.agent = exports.globalAgent;

    var defaultPort = options.defaultPort || 80;

    var port = options.port || defaultPort;
    var host = options.hostname || options.host || 'localhost';

    if (options.setHost === undefined) {
      var setHost = true;
    }

    self.socketPath = options.socketPath;

    var method = self.method = (options.method || 'GET').toUpperCase();
    self.path = options.path || '/';
    if (cb) {
      self.once('response', cb);
    }

    if (!Array.isArray(options.headers)) {
      if (options.headers) {
        var keys = Object.keys(options.headers);
        for (var i = 0, l = keys.length; i < l; i++) {
          var key = keys[i];
          self.setHeader(key, options.headers[key]);
        }
      }
      if (host && !this.getHeader('host') && setHost) {
        var hostHeader = host;
        if (port && +port !== defaultPort) {
          hostHeader += ':' + port;
        }
        this.setHeader('Host', hostHeader);
      }
    }

    if (options.auth && !this.getHeader('Authorization')) {
      //basic auth
      this.setHeader('Authorization', 'Basic ' +
                     new Buffer(options.auth).toString('base64'));
    }

    if (method === 'GET' || method === 'HEAD' || method === 'CONNECT') {
      self.useChunkedEncodingByDefault = false;
    } else {
      self.useChunkedEncodingByDefault = true;
    }

    if (Array.isArray(options.headers)) {
      self._storeHeader(self.method + ' ' + self.path + ' HTTP/1.1\r\n',
                        options.headers);
    } else if (self.getHeader('expect')) {
      self._storeHeader(self.method + ' ' + self.path + ' HTTP/1.1\r\n',
                        self._renderHeaders());
    }
    if (self.socketPath) {
      self._last = true;
      self.shouldKeepAlive = false;
      if (options.createConnection) {
        self.onSocket(options.createConnection(self.socketPath));
      } else {
        self.onSocket(net.createConnection(self.socketPath));
      }
    } else if (self.agent) {
      // If there is an agent we should default to Connection:keep-alive.
      self._last = false;
      self.shouldKeepAlive = true;
      self.agent.addRequest(self, host, port, options.localAddress);
    } else {
      // No agent, default to Connection:close.
      self._last = true;
      self.shouldKeepAlive = false;
      if (options.createConnection) {
        options.port = port;
        options.host = host;
        var conn = options.createConnection(options);
      } else {
        var conn = net.createConnection({
          port: port,
          host: host,
          localAddress: options.localAddress
        });
      }
      self.onSocket(conn);
    }

    self._deferToConnect(null, null, function() {
      self._flush();
      self = null;
    });
  };

  ClientRequest.prototype = ClientRequestPrototype;

} else {
  // Most of the node v0.11+ patching lives in _http_agent.js.
  // However we need to alias http.globalAgent to agent.globalAgent here.
  var globalAgentDescriptor = Object.getOwnPropertyDescriptor(agent,
                                                              'globalAgent');
  Object.defineProperty(exports, 'globalAgent', globalAgentDescriptor);
}
