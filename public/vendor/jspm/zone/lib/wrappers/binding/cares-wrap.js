module.exports = function(binding) {
  var cares_wrap = binding('cares_wrap');
  var isv010 = require('../../isv010.js');

  var wrapCaresQuery;
  var wrapLookup;

  if (isv010) {
    wrapCaresQuery = function(baseMethod) {
      return function query(name, callback) {
        // c-ares sometimes make synchronous callbacks, so we have to do our
        // zone wrapping before invoking the binding layer.
        callback = zone.bindAsyncCallback(req,
                                          callback,
                                          null,
                                          { name: baseMethod.name });

        var req = baseMethod.call(cares_wrap, name, callback);

        if (!req)
          zone.releaseCallback(callback);

        return req;
      };
    };

    wrapLookup = function(baseMethod) {
      return function lookup() {
        var req = baseMethod.apply(cares_wrap, arguments);

        if (!req)
          return req;

        wrapOnCompleteCallback(req, baseMethod.name);

        return req;
      };
    };

  } else {
    wrapCaresQuery = function(baseMethod) {
      return function query(req) {
        // c-ares sometimes make synchronous callbacks, so we have to do our
        // zone wrapping before invoking the binding layer.
        req.oncomplete = zone.bindAsyncCallback(req,
                                                req.oncomplete,
                                                null,
                                                { name: baseMethod.name });

        var result = baseMethod.apply(cares_wrap, arguments);

        if (result < 0)
          zone.releaseCallback(req.oncomplete);

        return result;
      };
    };

    wrapLookup = function(baseMethod) {
      return function lookup(req) {
        var result = baseMethod.apply(cares_wrap, arguments);

        if (result < 0)
          return result;

        wrapOnCompleteCallback(req, baseMethod.name);

        return result;
      };
    };
  }

  function wrapOnCompleteCallback(req, name) {
    req.__name__ = name;

    if (req.oncomplete) {
      req.__wrapped_oncomplete__ = zone.bindCallback(req,
                                                     req.oncomplete,
                                                     null,
                                                     { name: name });
    }

    req.__defineSetter__('oncomplete', captureUserOnCompleteCallback);
    req.__defineGetter__('oncomplete', getBindingOnCompleteCallback);
  }

  function captureUserOnCompleteCallback(callback) {
    if (this.__wrapped_oncomplete__)
      throw new Error('oncomplete already set');

    this.__wrapped_oncomplete__ = zone.bindCallback(this,
                                                    callback,
                                                    null,
                                                    { name: this.__name__ });
  }

  function getBindingOnCompleteCallback() {
    return this.__wrapped_oncomplete__;
  }

  return {
    getaddrinfo: wrapLookup(cares_wrap.getaddrinfo),
    getnameinfo: wrapLookup(cares_wrap.getaddrinfo),
    getHostByAddr: wrapLookup(cares_wrap.getHostByAddr),

    queryA: wrapCaresQuery(cares_wrap.queryA),
    queryAaaa: wrapCaresQuery(cares_wrap.queryAaaa),
    queryCname: wrapCaresQuery(cares_wrap.queryCname),
    queryMx: wrapCaresQuery(cares_wrap.queryMx),
    queryNaptr: wrapCaresQuery(cares_wrap.queryNaptr),
    queryNs: wrapCaresQuery(cares_wrap.queryNs),
    querySoa: wrapCaresQuery(cares_wrap.querySoa),
    querySrv: wrapCaresQuery(cares_wrap.querySrc),
    queryTxt: wrapCaresQuery(cares_wrap.queryTxt),

    getServers: cares_wrap.getServers,
    setServers: cares_wrap.setServers,

    isIP: cares_wrap.isIP,
    strerror: cares_wrap.strerror,

    AF_INET: cares_wrap.AF_INET,
    AF_INET6: cares_wrap.AF_INET6,
    AF_UNSPEC: cares_wrap.AF_UNSPEC,
    AI_ADDRCONFIG: cares_wrap.AI_ADDRCONFIG,
    AI_V4MAPPED: cares_wrap.AI_V4MAPPED
  };

};
