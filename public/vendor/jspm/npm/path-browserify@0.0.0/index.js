/* */ 
(function(process) {
  function normalizeArray(parts, allowAboveRoot) {
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === '.') {
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
  var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  var splitPath = function(filename) {
    return splitPathRe.exec(filename).slice(1);
  };
  exports.resolve = function() {
    var resolvedPath = '',
        resolvedAbsolute = false;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? arguments[i] : process.cwd();
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings');
      } else if (!path) {
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
    var isAbsolute = exports.isAbsolute(path),
        trailingSlash = substr(path, -1) === '/';
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
  exports.isAbsolute = function(path) {
    return path.charAt(0) === '/';
  };
  exports.join = function() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return exports.normalize(filter(paths, function(p, index) {
      if (typeof p !== 'string') {
        throw new TypeError('Arguments to path.join must be strings');
      }
      return p;
    }).join('/'));
  };
  exports.relative = function(from, to) {
    from = exports.resolve(from).substr(1);
    to = exports.resolve(to).substr(1);
    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== '')
          break;
      }
      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== '')
          break;
      }
      if (start > end)
        return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..');
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join('/');
  };
  exports.sep = '/';
  exports.delimiter = ':';
  exports.dirname = function(path) {
    var result = splitPath(path),
        root = result[0],
        dir = result[1];
    if (!root && !dir) {
      return '.';
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  };
  exports.basename = function(path, ext) {
    var f = splitPath(path)[2];
    if (ext && f.substr(-1 * ext.length) === ext) {
      f = f.substr(0, f.length - ext.length);
    }
    return f;
  };
  exports.extname = function(path) {
    return splitPath(path)[3];
  };
  function filter(xs, f) {
    if (xs.filter)
      return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
      if (f(xs[i], i, xs))
        res.push(xs[i]);
    }
    return res;
  }
  var substr = 'ab'.substr(-1) === 'b' ? function(str, start, len) {
    return str.substr(start, len);
  } : function(str, start, len) {
    if (start < 0)
      start = str.length + start;
    return str.substr(start, len);
  };
  ;
})(require('process'));
