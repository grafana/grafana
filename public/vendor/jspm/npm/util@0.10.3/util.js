/* */ 
(function(process) {
  var formatRegExp = /%[sdj%]/g;
  exports.format = function(f) {
    if (!isString(f)) {
      var objects = [];
      for (var i = 0; i < arguments.length; i++) {
        objects.push(inspect(arguments[i]));
      }
      return objects.join(' ');
    }
    var i = 1;
    var args = arguments;
    var len = args.length;
    var str = String(f).replace(formatRegExp, function(x) {
      if (x === '%%')
        return '%';
      if (i >= len)
        return x;
      switch (x) {
        case '%s':
          return String(args[i++]);
        case '%d':
          return Number(args[i++]);
        case '%j':
          try {
            return JSON.stringify(args[i++]);
          } catch (_) {
            return '[Circular]';
          }
        default:
          return x;
      }
    });
    for (var x = args[i]; i < len; x = args[++i]) {
      if (isNull(x) || !isObject(x)) {
        str += ' ' + x;
      } else {
        str += ' ' + inspect(x);
      }
    }
    return str;
  };
  exports.deprecate = function(fn, msg) {
    if (isUndefined(global.process)) {
      return function() {
        return exports.deprecate(fn, msg).apply(this, arguments);
      };
    }
    if (process.noDeprecation === true) {
      return fn;
    }
    var warned = false;
    function deprecated() {
      if (!warned) {
        if (process.throwDeprecation) {
          throw new Error(msg);
        } else if (process.traceDeprecation) {
          console.trace(msg);
        } else {
          console.error(msg);
        }
        warned = true;
      }
      return fn.apply(this, arguments);
    }
    return deprecated;
  };
  var debugs = {};
  var debugEnviron;
  exports.debuglog = function(set) {
    if (isUndefined(debugEnviron))
      debugEnviron = process.env.NODE_DEBUG || '';
    set = set.toUpperCase();
    if (!debugs[set]) {
      if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
        var pid = process.pid;
        debugs[set] = function() {
          var msg = exports.format.apply(exports, arguments);
          console.error('%s %d: %s', set, pid, msg);
        };
      } else {
        debugs[set] = function() {};
      }
    }
    return debugs[set];
  };
  function inspect(obj, opts) {
    var ctx = {
      seen: [],
      stylize: stylizeNoColor
    };
    if (arguments.length >= 3)
      ctx.depth = arguments[2];
    if (arguments.length >= 4)
      ctx.colors = arguments[3];
    if (isBoolean(opts)) {
      ctx.showHidden = opts;
    } else if (opts) {
      exports._extend(ctx, opts);
    }
    if (isUndefined(ctx.showHidden))
      ctx.showHidden = false;
    if (isUndefined(ctx.depth))
      ctx.depth = 2;
    if (isUndefined(ctx.colors))
      ctx.colors = false;
    if (isUndefined(ctx.customInspect))
      ctx.customInspect = true;
    if (ctx.colors)
      ctx.stylize = stylizeWithColor;
    return formatValue(ctx, obj, ctx.depth);
  }
  exports.inspect = inspect;
  inspect.colors = {
    'bold': [1, 22],
    'italic': [3, 23],
    'underline': [4, 24],
    'inverse': [7, 27],
    'white': [37, 39],
    'grey': [90, 39],
    'black': [30, 39],
    'blue': [34, 39],
    'cyan': [36, 39],
    'green': [32, 39],
    'magenta': [35, 39],
    'red': [31, 39],
    'yellow': [33, 39]
  };
  inspect.styles = {
    'special': 'cyan',
    'number': 'yellow',
    'boolean': 'yellow',
    'undefined': 'grey',
    'null': 'bold',
    'string': 'green',
    'date': 'magenta',
    'regexp': 'red'
  };
  function stylizeWithColor(str, styleType) {
    var style = inspect.styles[styleType];
    if (style) {
      return '\u001b[' + inspect.colors[style][0] + 'm' + str + '\u001b[' + inspect.colors[style][1] + 'm';
    } else {
      return str;
    }
  }
  function stylizeNoColor(str, styleType) {
    return str;
  }
  function arrayToHash(array) {
    var hash = {};
    array.forEach(function(val, idx) {
      hash[val] = true;
    });
    return hash;
  }
  function formatValue(ctx, value, recurseTimes) {
    if (ctx.customInspect && value && isFunction(value.inspect) && value.inspect !== exports.inspect && !(value.constructor && value.constructor.prototype === value)) {
      var ret = value.inspect(recurseTimes, ctx);
      if (!isString(ret)) {
        ret = formatValue(ctx, ret, recurseTimes);
      }
      return ret;
    }
    var primitive = formatPrimitive(ctx, value);
    if (primitive) {
      return primitive;
    }
    var keys = Object.keys(value);
    var visibleKeys = arrayToHash(keys);
    if (ctx.showHidden) {
      keys = Object.getOwnPropertyNames(value);
    }
    if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
      return formatError(value);
    }
    if (keys.length === 0) {
      if (isFunction(value)) {
        var name = value.name ? ': ' + value.name : '';
        return ctx.stylize('[Function' + name + ']', 'special');
      }
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      }
      if (isDate(value)) {
        return ctx.stylize(Date.prototype.toString.call(value), 'date');
      }
      if (isError(value)) {
        return formatError(value);
      }
    }
    var base = '',
        array = false,
        braces = ['{', '}'];
    if (isArray(value)) {
      array = true;
      braces = ['[', ']'];
    }
    if (isFunction(value)) {
      var n = value.name ? ': ' + value.name : '';
      base = ' [Function' + n + ']';
    }
    if (isRegExp(value)) {
      base = ' ' + RegExp.prototype.toString.call(value);
    }
    if (isDate(value)) {
      base = ' ' + Date.prototype.toUTCString.call(value);
    }
    if (isError(value)) {
      base = ' ' + formatError(value);
    }
    if (keys.length === 0 && (!array || value.length == 0)) {
      return braces[0] + base + braces[1];
    }
    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      } else {
        return ctx.stylize('[Object]', 'special');
      }
    }
    ctx.seen.push(value);
    var output;
    if (array) {
      output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
    } else {
      output = keys.map(function(key) {
        return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
      });
    }
    ctx.seen.pop();
    return reduceToSingleString(output, base, braces);
  }
  function formatPrimitive(ctx, value) {
    if (isUndefined(value))
      return ctx.stylize('undefined', 'undefined');
    if (isString(value)) {
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + '\'';
      return ctx.stylize(simple, 'string');
    }
    if (isNumber(value))
      return ctx.stylize('' + value, 'number');
    if (isBoolean(value))
      return ctx.stylize('' + value, 'boolean');
    if (isNull(value))
      return ctx.stylize('null', 'null');
  }
  function formatError(value) {
    return '[' + Error.prototype.toString.call(value) + ']';
  }
  function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
    var output = [];
    for (var i = 0,
        l = value.length; i < l; ++i) {
      if (hasOwnProperty(value, String(i))) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
      } else {
        output.push('');
      }
    }
    keys.forEach(function(key) {
      if (!key.match(/^\d+$/)) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
      }
    });
    return output;
  }
  function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
    var name,
        str,
        desc;
    desc = Object.getOwnPropertyDescriptor(value, key) || {value: value[key]};
    if (desc.get) {
      if (desc.set) {
        str = ctx.stylize('[Getter/Setter]', 'special');
      } else {
        str = ctx.stylize('[Getter]', 'special');
      }
    } else {
      if (desc.set) {
        str = ctx.stylize('[Setter]', 'special');
      }
    }
    if (!hasOwnProperty(visibleKeys, key)) {
      name = '[' + key + ']';
    }
    if (!str) {
      if (ctx.seen.indexOf(desc.value) < 0) {
        if (isNull(recurseTimes)) {
          str = formatValue(ctx, desc.value, null);
        } else {
          str = formatValue(ctx, desc.value, recurseTimes - 1);
        }
        if (str.indexOf('\n') > -1) {
          if (array) {
            str = str.split('\n').map(function(line) {
              return '  ' + line;
            }).join('\n').substr(2);
          } else {
            str = '\n' + str.split('\n').map(function(line) {
              return '   ' + line;
            }).join('\n');
          }
        }
      } else {
        str = ctx.stylize('[Circular]', 'special');
      }
    }
    if (isUndefined(name)) {
      if (array && key.match(/^\d+$/)) {
        return str;
      }
      name = JSON.stringify('' + key);
      if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
        name = name.substr(1, name.length - 2);
        name = ctx.stylize(name, 'name');
      } else {
        name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
        name = ctx.stylize(name, 'string');
      }
    }
    return name + ': ' + str;
  }
  function reduceToSingleString(output, base, braces) {
    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0)
        numLinesEst++;
      return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
    }, 0);
    if (length > 60) {
      return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
    }
    return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
  }
  function isArray(ar) {
    return Array.isArray(ar);
  }
  exports.isArray = isArray;
  function isBoolean(arg) {
    return typeof arg === 'boolean';
  }
  exports.isBoolean = isBoolean;
  function isNull(arg) {
    return arg === null;
  }
  exports.isNull = isNull;
  function isNullOrUndefined(arg) {
    return arg == null;
  }
  exports.isNullOrUndefined = isNullOrUndefined;
  function isNumber(arg) {
    return typeof arg === 'number';
  }
  exports.isNumber = isNumber;
  function isString(arg) {
    return typeof arg === 'string';
  }
  exports.isString = isString;
  function isSymbol(arg) {
    return typeof arg === 'symbol';
  }
  exports.isSymbol = isSymbol;
  function isUndefined(arg) {
    return arg === void 0;
  }
  exports.isUndefined = isUndefined;
  function isRegExp(re) {
    return isObject(re) && objectToString(re) === '[object RegExp]';
  }
  exports.isRegExp = isRegExp;
  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }
  exports.isObject = isObject;
  function isDate(d) {
    return isObject(d) && objectToString(d) === '[object Date]';
  }
  exports.isDate = isDate;
  function isError(e) {
    return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
  }
  exports.isError = isError;
  function isFunction(arg) {
    return typeof arg === 'function';
  }
  exports.isFunction = isFunction;
  function isPrimitive(arg) {
    return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'symbol' || typeof arg === 'undefined';
  }
  exports.isPrimitive = isPrimitive;
  exports.isBuffer = require('./support/isBufferBrowser');
  function objectToString(o) {
    return Object.prototype.toString.call(o);
  }
  function pad(n) {
    return n < 10 ? '0' + n.toString(10) : n.toString(10);
  }
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function timestamp() {
    var d = new Date();
    var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(':');
    return [d.getDate(), months[d.getMonth()], time].join(' ');
  }
  exports.log = function() {
    console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
  };
  exports.inherits = require('inherits');
  exports._extend = function(origin, add) {
    if (!add || !isObject(add))
      return origin;
    var keys = Object.keys(add);
    var i = keys.length;
    while (i--) {
      origin[keys[i]] = add[keys[i]];
    }
    return origin;
  };
  function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }
})(require('process'));
