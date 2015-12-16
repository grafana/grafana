/*
  SystemJS CommonJS Format
*/
(function() {
  // CJS Module Format
  // require('...') || exports[''] = ... || exports.asd = ... || module.exports = ...
  var cjsExportsRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.]|module\.)exports\s*(\[['"]|\.)|(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])module\.exports\s*[=,]/;
  // RegEx adjusted from https://github.com/jbrantly/yabble/blob/master/lib/yabble.js#L339
  var cjsRequireRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF."'])require\s*\(\s*("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s*\)/g;
  var commentRegEx = /(^|[^\\])(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;

  var stringRegEx = /(?:"[^"\\\n\r]*(?:\\.[^"\\\n\r]*)*"|'[^'\\\n\r]*(?:\\.[^'\\\n\r]*)*')/g;

  function getCJSDeps(source) {
    cjsRequireRegEx.lastIndex = commentRegEx.lastIndex = stringRegEx.lastIndex = 0;

    var deps = [];

    var match;

    // track string and comment locations for unminified source    
    var stringLocations = [], commentLocations = [];

    function inLocation(locations, match, starts) {
      var inLocation = false;
      for (var i = 0; i < locations.length; i++)
        if (locations[i][0] < match.index && locations[i][1] > match.index + (!starts ? match[0].length : 0))
          return true;
      return false;
    }

    if (source.length / source.split('\n').length < 200) {
      while (match = stringRegEx.exec(source))
        stringLocations.push([match.index, match.index + match[0].length]);
      
      while (match = commentRegEx.exec(source)) {
        // only track comments not starting in strings
        if (!inLocation(stringLocations, match, true))
          commentLocations.push([match.index, match.index + match[0].length]);
      }
    }

    while (match = cjsRequireRegEx.exec(source)) {
      // ensure we're not within a string or comment location
      if (!inLocation(stringLocations, match) && !inLocation(commentLocations, match))
        deps.push(match[1].substr(1, match[1].length - 2));
    }

    return deps;
  }

  if (typeof window != 'undefined' && typeof document != 'undefined' && window.location)
    var windowOrigin = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');

  // include the node require since we're overriding it
  if (typeof require != 'undefined' && require.resolve && typeof process != 'undefined')
    SystemJSLoader.prototype._nodeRequire = require;

  var nodeCoreModules = ['assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 
      'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https', 'module', 'net', 'os', 'path', 
      'process', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 
      'tls', 'tty', 'url', 'util', 'vm', 'zlib'];

  hook('normalize', function(normalize) {
    return function(name, parentName) {
      // dynamically load node-core modules when requiring `@node/fs` for example
      if (name.substr(0, 6) == '@node/' && nodeCoreModules.indexOf(name.substr(6)) != -1) {
        if (!this._nodeRequire)
          throw new TypeError('Can only load node core modules in Node.');
        this.set(name, this.newModule(getESModule(this._nodeRequire(name.substr(6)))));
      }

      return normalize.apply(this, arguments);
    };
  });

  hook('instantiate', function(instantiate) {
    return function(load) {
      var loader = this;
      if (!load.metadata.format) {
        cjsExportsRegEx.lastIndex = 0;
        cjsRequireRegEx.lastIndex = 0;
        if (cjsRequireRegEx.exec(load.source) || cjsExportsRegEx.exec(load.source))
          load.metadata.format = 'cjs';
      }

      if (load.metadata.format == 'cjs') {
        var metaDeps = load.metadata.deps;
        var deps = getCJSDeps(load.source);

        for (var g in load.metadata.globals)
          deps.push(load.metadata.globals[g]);

        var entry = createEntry();

        load.metadata.entry = entry;

        entry.deps = deps;
        entry.executingRequire = true;
        entry.execute = function(require, exports, module) {
          // ensure meta deps execute first
          for (var i = 0; i < metaDeps.length; i++)
            require(metaDeps[i]);
          var address = load.address || '';

          var dirname = address.split('/');
          dirname.pop();
          dirname = dirname.join('/');

          if (address.substr(0, 8) == 'file:///') {
            address = address.substr(7);
            dirname = dirname.substr(7);

            // on windows remove leading '/'
            if (isWindows) {
              address = address.substr(1);
              dirname = dirname.substr(1);
            }
          }
          else if (windowOrigin && address.substr(0, windowOrigin.length) === windowOrigin) {
            address = address.substr(windowOrigin.length);
            dirname = dirname.substr(windowOrigin.length);
          }

          // disable AMD detection
          var define = __global.define;
          __global.define = undefined;

          __global.__cjsWrapper = {
            exports: exports,
            args: [require, exports, module, address, dirname, __global, __global]
          };

          var globals = '';
          if (load.metadata.globals) {
            for (var g in load.metadata.globals)
              globals += 'var ' + g + ' = require("' + load.metadata.globals[g] + '");';
          }

          load.source = "(function(require, exports, module, __filename, __dirname, global, GLOBAL) {" + globals
              + load.source + "\n}).apply(__cjsWrapper.exports, __cjsWrapper.args);";

          __exec.call(loader, load);

          __global.__cjsWrapper = undefined;
          __global.define = define;
        };
      }

      return instantiate.call(loader, load);
    };
  });
})();
