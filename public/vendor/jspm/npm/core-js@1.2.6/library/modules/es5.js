/* */ 
'use strict';
var $ = require('./$'),
    $export = require('./$.export'),
    DESCRIPTORS = require('./$.descriptors'),
    createDesc = require('./$.property-desc'),
    html = require('./$.html'),
    cel = require('./$.dom-create'),
    has = require('./$.has'),
    cof = require('./$.cof'),
    invoke = require('./$.invoke'),
    fails = require('./$.fails'),
    anObject = require('./$.an-object'),
    aFunction = require('./$.a-function'),
    isObject = require('./$.is-object'),
    toObject = require('./$.to-object'),
    toIObject = require('./$.to-iobject'),
    toInteger = require('./$.to-integer'),
    toIndex = require('./$.to-index'),
    toLength = require('./$.to-length'),
    IObject = require('./$.iobject'),
    IE_PROTO = require('./$.uid')('__proto__'),
    createArrayMethod = require('./$.array-methods'),
    arrayIndexOf = require('./$.array-includes')(false),
    ObjectProto = Object.prototype,
    ArrayProto = Array.prototype,
    arraySlice = ArrayProto.slice,
    arrayJoin = ArrayProto.join,
    defineProperty = $.setDesc,
    getOwnDescriptor = $.getDesc,
    defineProperties = $.setDescs,
    factories = {},
    IE8_DOM_DEFINE;
if (!DESCRIPTORS) {
  IE8_DOM_DEFINE = !fails(function() {
    return defineProperty(cel('div'), 'a', {get: function() {
        return 7;
      }}).a != 7;
  });
  $.setDesc = function(O, P, Attributes) {
    if (IE8_DOM_DEFINE)
      try {
        return defineProperty(O, P, Attributes);
      } catch (e) {}
    if ('get' in Attributes || 'set' in Attributes)
      throw TypeError('Accessors not supported!');
    if ('value' in Attributes)
      anObject(O)[P] = Attributes.value;
    return O;
  };
  $.getDesc = function(O, P) {
    if (IE8_DOM_DEFINE)
      try {
        return getOwnDescriptor(O, P);
      } catch (e) {}
    if (has(O, P))
      return createDesc(!ObjectProto.propertyIsEnumerable.call(O, P), O[P]);
  };
  $.setDescs = defineProperties = function(O, Properties) {
    anObject(O);
    var keys = $.getKeys(Properties),
        length = keys.length,
        i = 0,
        P;
    while (length > i)
      $.setDesc(O, P = keys[i++], Properties[P]);
    return O;
  };
}
$export($export.S + $export.F * !DESCRIPTORS, 'Object', {
  getOwnPropertyDescriptor: $.getDesc,
  defineProperty: $.setDesc,
  defineProperties: defineProperties
});
var keys1 = ('constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,' + 'toLocaleString,toString,valueOf').split(','),
    keys2 = keys1.concat('length', 'prototype'),
    keysLen1 = keys1.length;
var createDict = function() {
  var iframe = cel('iframe'),
      i = keysLen1,
      gt = '>',
      iframeDocument;
  iframe.style.display = 'none';
  html.appendChild(iframe);
  iframe.src = 'javascript:';
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write('<script>document.F=Object</script' + gt);
  iframeDocument.close();
  createDict = iframeDocument.F;
  while (i--)
    delete createDict.prototype[keys1[i]];
  return createDict();
};
var createGetKeys = function(names, length) {
  return function(object) {
    var O = toIObject(object),
        i = 0,
        result = [],
        key;
    for (key in O)
      if (key != IE_PROTO)
        has(O, key) && result.push(key);
    while (length > i)
      if (has(O, key = names[i++])) {
        ~arrayIndexOf(result, key) || result.push(key);
      }
    return result;
  };
};
var Empty = function() {};
$export($export.S, 'Object', {
  getPrototypeOf: $.getProto = $.getProto || function(O) {
    O = toObject(O);
    if (has(O, IE_PROTO))
      return O[IE_PROTO];
    if (typeof O.constructor == 'function' && O instanceof O.constructor) {
      return O.constructor.prototype;
    }
    return O instanceof Object ? ObjectProto : null;
  },
  getOwnPropertyNames: $.getNames = $.getNames || createGetKeys(keys2, keys2.length, true),
  create: $.create = $.create || function(O, Properties) {
    var result;
    if (O !== null) {
      Empty.prototype = anObject(O);
      result = new Empty();
      Empty.prototype = null;
      result[IE_PROTO] = O;
    } else
      result = createDict();
    return Properties === undefined ? result : defineProperties(result, Properties);
  },
  keys: $.getKeys = $.getKeys || createGetKeys(keys1, keysLen1, false)
});
var construct = function(F, len, args) {
  if (!(len in factories)) {
    for (var n = [],
        i = 0; i < len; i++)
      n[i] = 'a[' + i + ']';
    factories[len] = Function('F,a', 'return new F(' + n.join(',') + ')');
  }
  return factories[len](F, args);
};
$export($export.P, 'Function', {bind: function bind(that) {
    var fn = aFunction(this),
        partArgs = arraySlice.call(arguments, 1);
    var bound = function() {
      var args = partArgs.concat(arraySlice.call(arguments));
      return this instanceof bound ? construct(fn, args.length, args) : invoke(fn, args, that);
    };
    if (isObject(fn.prototype))
      bound.prototype = fn.prototype;
    return bound;
  }});
$export($export.P + $export.F * fails(function() {
  if (html)
    arraySlice.call(html);
}), 'Array', {slice: function(begin, end) {
    var len = toLength(this.length),
        klass = cof(this);
    end = end === undefined ? len : end;
    if (klass == 'Array')
      return arraySlice.call(this, begin, end);
    var start = toIndex(begin, len),
        upTo = toIndex(end, len),
        size = toLength(upTo - start),
        cloned = Array(size),
        i = 0;
    for (; i < size; i++)
      cloned[i] = klass == 'String' ? this.charAt(start + i) : this[start + i];
    return cloned;
  }});
$export($export.P + $export.F * (IObject != Object), 'Array', {join: function join(separator) {
    return arrayJoin.call(IObject(this), separator === undefined ? ',' : separator);
  }});
$export($export.S, 'Array', {isArray: require('./$.is-array')});
var createArrayReduce = function(isRight) {
  return function(callbackfn, memo) {
    aFunction(callbackfn);
    var O = IObject(this),
        length = toLength(O.length),
        index = isRight ? length - 1 : 0,
        i = isRight ? -1 : 1;
    if (arguments.length < 2)
      for (; ; ) {
        if (index in O) {
          memo = O[index];
          index += i;
          break;
        }
        index += i;
        if (isRight ? index < 0 : length <= index) {
          throw TypeError('Reduce of empty array with no initial value');
        }
      }
    for (; isRight ? index >= 0 : length > index; index += i)
      if (index in O) {
        memo = callbackfn(memo, O[index], index, this);
      }
    return memo;
  };
};
var methodize = function($fn) {
  return function(arg1) {
    return $fn(this, arg1, arguments[1]);
  };
};
$export($export.P, 'Array', {
  forEach: $.each = $.each || methodize(createArrayMethod(0)),
  map: methodize(createArrayMethod(1)),
  filter: methodize(createArrayMethod(2)),
  some: methodize(createArrayMethod(3)),
  every: methodize(createArrayMethod(4)),
  reduce: createArrayReduce(false),
  reduceRight: createArrayReduce(true),
  indexOf: methodize(arrayIndexOf),
  lastIndexOf: function(el, fromIndex) {
    var O = toIObject(this),
        length = toLength(O.length),
        index = length - 1;
    if (arguments.length > 1)
      index = Math.min(index, toInteger(fromIndex));
    if (index < 0)
      index = toLength(length + index);
    for (; index >= 0; index--)
      if (index in O)
        if (O[index] === el)
          return index;
    return -1;
  }
});
$export($export.S, 'Date', {now: function() {
    return +new Date;
  }});
var lz = function(num) {
  return num > 9 ? num : '0' + num;
};
$export($export.P + $export.F * (fails(function() {
  return new Date(-5e13 - 1).toISOString() != '0385-07-25T07:06:39.999Z';
}) || !fails(function() {
  new Date(NaN).toISOString();
})), 'Date', {toISOString: function toISOString() {
    if (!isFinite(this))
      throw RangeError('Invalid time value');
    var d = this,
        y = d.getUTCFullYear(),
        m = d.getUTCMilliseconds(),
        s = y < 0 ? '-' : y > 9999 ? '+' : '';
    return s + ('00000' + Math.abs(y)).slice(s ? -6 : -4) + '-' + lz(d.getUTCMonth() + 1) + '-' + lz(d.getUTCDate()) + 'T' + lz(d.getUTCHours()) + ':' + lz(d.getUTCMinutes()) + ':' + lz(d.getUTCSeconds()) + '.' + (m > 99 ? m : '0' + lz(m)) + 'Z';
  }});
