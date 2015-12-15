/* */ 
(function(process) {
  var require = function(file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod)
      throw new Error('Failed to resolve module ' + file + ', tried ' + resolved);
    var res = mod._cached ? mod._cached : mod();
    return res;
  };
  require.paths = [];
  require.modules = {};
  require.extensions = [".js", ".coffee"];
  require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
  };
  require.resolve = (function() {
    return function(x, cwd) {
      if (!cwd)
        cwd = '/';
      if (require._core[x])
        return x;
      var path = require.modules.path();
      var y = cwd || '.';
      if (x.match(/^(?:\.\.?\/|\/)/)) {
        var m = loadAsFileSync(path.resolve(y, x)) || loadAsDirectorySync(path.resolve(y, x));
        if (m)
          return m;
      }
      var n = loadNodeModulesSync(x, y);
      if (n)
        return n;
      throw new Error("Cannot find module '" + x + "'");
      function loadAsFileSync(x) {
        if (require.modules[x]) {
          return x;
        }
        for (var i = 0; i < require.extensions.length; i++) {
          var ext = require.extensions[i];
          if (require.modules[x + ext])
            return x + ext;
        }
      }
      function loadAsDirectorySync(x) {
        x = x.replace(/\/+$/, '');
        var pkgfile = x + '/package.json';
        if (require.modules[pkgfile]) {
          var pkg = require.modules[pkgfile]();
          var b = pkg.browserify;
          if (typeof b === 'object' && b.main) {
            var m = loadAsFileSync(path.resolve(x, b.main));
            if (m)
              return m;
          } else if (typeof b === 'string') {
            var m = loadAsFileSync(path.resolve(x, b));
            if (m)
              return m;
          } else if (pkg.main) {
            var m = loadAsFileSync(path.resolve(x, pkg.main));
            if (m)
              return m;
          }
        }
        return loadAsFileSync(x + '/index');
      }
      function loadNodeModulesSync(x, start) {
        var dirs = nodeModulesPathsSync(start);
        for (var i = 0; i < dirs.length; i++) {
          var dir = dirs[i];
          var m = loadAsFileSync(dir + '/' + x);
          if (m)
            return m;
          var n = loadAsDirectorySync(dir + '/' + x);
          if (n)
            return n;
        }
        var m = loadAsFileSync(x);
        if (m)
          return m;
      }
      function nodeModulesPathsSync(start) {
        var parts;
        if (start === '/')
          parts = [''];
        else
          parts = path.normalize(start).split('/');
        var dirs = [];
        for (var i = parts.length - 1; i >= 0; i--) {
          if (parts[i] === 'node_modules')
            continue;
          var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
          dirs.push(dir);
        }
        return dirs;
      }
    };
  })();
  require.alias = function(from, to) {
    var path = require.modules.path();
    var res = null;
    try {
      res = require.resolve(from + '/package.json', '/');
    } catch (err) {
      res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    var keys = (Object.keys || function(obj) {
      var res = [];
      for (var key in obj)
        res.push(key);
      return res;
    })(require.modules);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.slice(0, basedir.length + 1) === basedir + '/') {
        var f = key.slice(basedir.length);
        require.modules[to + f] = require.modules[basedir + f];
      } else if (key === basedir) {
        require.modules[to] = require.modules[basedir];
      }
    }
  };
  require.define = function(filename, fn) {
    var dirname = require._core[filename] ? '' : require.modules.path().dirname(filename);
    ;
    var require_ = function(file) {
      return require(file, dirname);
    };
    require_.resolve = function(name) {
      return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = {exports: {}};
    require.modules[filename] = function() {
      require.modules[filename]._cached = module_.exports;
      fn.call(module_.exports, require_, module_, module_.exports, dirname, filename);
      require.modules[filename]._cached = module_.exports;
      return module_.exports;
    };
  };
  if (typeof process === 'undefined')
    process = {};
  if (!process.nextTick)
    process.nextTick = (function() {
      var queue = [];
      var canPost = typeof window !== 'undefined' && window.postMessage && window.addEventListener;
      ;
      if (canPost) {
        window.addEventListener('message', function(ev) {
          if (ev.source === window && ev.data === 'browserify-tick') {
            ev.stopPropagation();
            if (queue.length > 0) {
              var fn = queue.shift();
              fn();
            }
          }
        }, true);
      }
      return function(fn) {
        if (canPost) {
          queue.push(fn);
          window.postMessage('browserify-tick', '*');
        } else
          setTimeout(fn, 0);
      };
    })();
  if (!process.title)
    process.title = 'browser';
  if (!process.binding)
    process.binding = function(name) {
      if (name === 'evals')
        return require('vm');
      else
        throw new Error('No such module');
    };
  if (!process.cwd)
    process.cwd = function() {
      return '.';
    };
  require.define("path", function(require, module, exports, __dirname, __filename) {
    function filter(xs, fn) {
      var res = [];
      for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs))
          res.push(xs[i]);
      }
      return res;
    }
    function normalizeArray(parts, allowAboveRoot) {
      var up = 0;
      for (var i = parts.length; i >= 0; i--) {
        var last = parts[i];
        if (last == '.') {
          parts.splice(i, 1);
        } else if (last === '..') {
          parts.splice(i, 1);
          up++;
        } else if (up) {
          parts.splice(i, 1);
          up--;
        }
      }
      if (allowAboveRoot) {
        for (; up--; up) {
          parts.unshift('..');
        }
      }
      return parts;
    }
    var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;
    exports.resolve = function() {
      var resolvedPath = '',
          resolvedAbsolute = false;
      for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
        var path = (i >= 0) ? arguments[i] : process.cwd();
        if (typeof path !== 'string' || !path) {
          continue;
        }
        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = path.charAt(0) === '/';
      }
      resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
        return !!p;
      }), !resolvedAbsolute).join('/');
      return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
    };
    exports.normalize = function(path) {
      var isAbsolute = path.charAt(0) === '/',
          trailingSlash = path.slice(-1) === '/';
      path = normalizeArray(filter(path.split('/'), function(p) {
        return !!p;
      }), !isAbsolute).join('/');
      if (!path && !isAbsolute) {
        path = '.';
      }
      if (path && trailingSlash) {
        path += '/';
      }
      return (isAbsolute ? '/' : '') + path;
    };
    exports.join = function() {
      var paths = Array.prototype.slice.call(arguments, 0);
      return exports.normalize(filter(paths, function(p, index) {
        return p && typeof p === 'string';
      }).join('/'));
    };
    exports.dirname = function(path) {
      var dir = splitPathRe.exec(path)[1] || '';
      var isWindows = false;
      if (!dir) {
        return '.';
      } else if (dir.length === 1 || (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
        return dir;
      } else {
        return dir.substring(0, dir.length - 1);
      }
    };
    exports.basename = function(path, ext) {
      var f = splitPathRe.exec(path)[2] || '';
      if (ext && f.substr(-1 * ext.length) === ext) {
        f = f.substr(0, f.length - ext.length);
      }
      return f;
    };
    exports.extname = function(path) {
      return splitPathRe.exec(path)[3] || '';
    };
  });
  require.define("vm", function(require, module, exports, __dirname, __filename) {
    var Object_keys = function(obj) {
      if (Object.keys)
        return Object.keys(obj);
      else {
        var res = [];
        for (var key in obj)
          res.push(key);
        return res;
      }
    };
    var forEach = function(xs, fn) {
      if (xs.forEach)
        return xs.forEach(fn);
      else
        for (var i = 0; i < xs.length; i++) {
          fn(xs[i], i, xs);
        }
    };
    var Script = exports.Script = function NodeScript(code) {
      if (!(this instanceof Script))
        return new Script(code);
      this.code = code;
    };
    var iframe = document.createElement('iframe');
    if (!iframe.style)
      iframe.style = {};
    iframe.style.display = 'none';
    var iframeCapable = true;
    if (navigator.appName === 'Microsoft Internet Explorer') {
      var m = navigator.appVersion.match(/\bMSIE (\d+\.\d+);/);
      if (m && parseFloat(m[1]) <= 9.0) {
        iframeCapable = false;
      }
    }
    Script.prototype.runInNewContext = function(context) {
      if (!context)
        context = {};
      if (!iframeCapable) {
        var keys = Object_keys(context);
        var args = [];
        for (var i = 0; i < keys.length; i++) {
          args.push(context[keys[i]]);
        }
        var fn = new Function(keys, 'return ' + this.code);
        return fn.apply(null, args);
      }
      document.body.appendChild(iframe);
      var win = iframe.contentWindow || (window.frames && window.frames[window.frames.length - 1]) || window[window.length - 1];
      ;
      forEach(Object_keys(context), function(key) {
        win[key] = context[key];
        iframe[key] = context[key];
      });
      if (win.eval) {
        var res = win.eval(this.code);
      } else {
        iframe.setAttribute('src', 'javascript:__browserifyVmResult=(' + this.code + ')');
        if ('__browserifyVmResult' in win) {
          var res = win.__browserifyVmResult;
        } else {
          iframeCapable = false;
          res = this.runInThisContext(context);
        }
      }
      forEach(Object_keys(win), function(key) {
        context[key] = win[key];
      });
      document.body.removeChild(iframe);
      return res;
    };
    Script.prototype.runInThisContext = function() {
      return eval(this.code);
    };
    Script.prototype.runInContext = function(context) {
      return this.runInNewContext(context);
    };
    forEach(Object_keys(Script.prototype), function(name) {
      exports[name] = Script[name] = function(code) {
        var s = Script(code);
        return s[name].apply(s, [].slice.call(arguments, 1));
      };
    });
    exports.createScript = function(code) {
      return exports.Script(code);
    };
    exports.createContext = Script.createContext = function(context) {
      var copy = {};
      forEach(Object_keys(context), function(key) {
        copy[key] = context[key];
      });
      return copy;
    };
  });
  require.define("/entry.js", function(require, module, exports, __dirname, __filename) {
    var vm = require('vm');
    $(function() {
      var res = vm.runInNewContext('a + 5', {a: 100});
      $('#res').text(res);
    });
  });
  require('/entry');
})(require('process'));
