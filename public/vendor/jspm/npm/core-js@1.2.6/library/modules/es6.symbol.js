/* */ 
'use strict';
var $ = require('./$'),
    global = require('./$.global'),
    has = require('./$.has'),
    DESCRIPTORS = require('./$.descriptors'),
    $export = require('./$.export'),
    redefine = require('./$.redefine'),
    $fails = require('./$.fails'),
    shared = require('./$.shared'),
    setToStringTag = require('./$.set-to-string-tag'),
    uid = require('./$.uid'),
    wks = require('./$.wks'),
    keyOf = require('./$.keyof'),
    $names = require('./$.get-names'),
    enumKeys = require('./$.enum-keys'),
    isArray = require('./$.is-array'),
    anObject = require('./$.an-object'),
    toIObject = require('./$.to-iobject'),
    createDesc = require('./$.property-desc'),
    getDesc = $.getDesc,
    setDesc = $.setDesc,
    _create = $.create,
    getNames = $names.get,
    $Symbol = global.Symbol,
    $JSON = global.JSON,
    _stringify = $JSON && $JSON.stringify,
    setter = false,
    HIDDEN = wks('_hidden'),
    isEnum = $.isEnum,
    SymbolRegistry = shared('symbol-registry'),
    AllSymbols = shared('symbols'),
    useNative = typeof $Symbol == 'function',
    ObjectProto = Object.prototype;
var setSymbolDesc = DESCRIPTORS && $fails(function() {
  return _create(setDesc({}, 'a', {get: function() {
      return setDesc(this, 'a', {value: 7}).a;
    }})).a != 7;
}) ? function(it, key, D) {
  var protoDesc = getDesc(ObjectProto, key);
  if (protoDesc)
    delete ObjectProto[key];
  setDesc(it, key, D);
  if (protoDesc && it !== ObjectProto)
    setDesc(ObjectProto, key, protoDesc);
} : setDesc;
var wrap = function(tag) {
  var sym = AllSymbols[tag] = _create($Symbol.prototype);
  sym._k = tag;
  DESCRIPTORS && setter && setSymbolDesc(ObjectProto, tag, {
    configurable: true,
    set: function(value) {
      if (has(this, HIDDEN) && has(this[HIDDEN], tag))
        this[HIDDEN][tag] = false;
      setSymbolDesc(this, tag, createDesc(1, value));
    }
  });
  return sym;
};
var isSymbol = function(it) {
  return typeof it == 'symbol';
};
var $defineProperty = function defineProperty(it, key, D) {
  if (D && has(AllSymbols, key)) {
    if (!D.enumerable) {
      if (!has(it, HIDDEN))
        setDesc(it, HIDDEN, createDesc(1, {}));
      it[HIDDEN][key] = true;
    } else {
      if (has(it, HIDDEN) && it[HIDDEN][key])
        it[HIDDEN][key] = false;
      D = _create(D, {enumerable: createDesc(0, false)});
    }
    return setSymbolDesc(it, key, D);
  }
  return setDesc(it, key, D);
};
var $defineProperties = function defineProperties(it, P) {
  anObject(it);
  var keys = enumKeys(P = toIObject(P)),
      i = 0,
      l = keys.length,
      key;
  while (l > i)
    $defineProperty(it, key = keys[i++], P[key]);
  return it;
};
var $create = function create(it, P) {
  return P === undefined ? _create(it) : $defineProperties(_create(it), P);
};
var $propertyIsEnumerable = function propertyIsEnumerable(key) {
  var E = isEnum.call(this, key);
  return E || !has(this, key) || !has(AllSymbols, key) || has(this, HIDDEN) && this[HIDDEN][key] ? E : true;
};
var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(it, key) {
  var D = getDesc(it = toIObject(it), key);
  if (D && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key]))
    D.enumerable = true;
  return D;
};
var $getOwnPropertyNames = function getOwnPropertyNames(it) {
  var names = getNames(toIObject(it)),
      result = [],
      i = 0,
      key;
  while (names.length > i)
    if (!has(AllSymbols, key = names[i++]) && key != HIDDEN)
      result.push(key);
  return result;
};
var $getOwnPropertySymbols = function getOwnPropertySymbols(it) {
  var names = getNames(toIObject(it)),
      result = [],
      i = 0,
      key;
  while (names.length > i)
    if (has(AllSymbols, key = names[i++]))
      result.push(AllSymbols[key]);
  return result;
};
var $stringify = function stringify(it) {
  if (it === undefined || isSymbol(it))
    return;
  var args = [it],
      i = 1,
      $$ = arguments,
      replacer,
      $replacer;
  while ($$.length > i)
    args.push($$[i++]);
  replacer = args[1];
  if (typeof replacer == 'function')
    $replacer = replacer;
  if ($replacer || !isArray(replacer))
    replacer = function(key, value) {
      if ($replacer)
        value = $replacer.call(this, key, value);
      if (!isSymbol(value))
        return value;
    };
  args[1] = replacer;
  return _stringify.apply($JSON, args);
};
var buggyJSON = $fails(function() {
  var S = $Symbol();
  return _stringify([S]) != '[null]' || _stringify({a: S}) != '{}' || _stringify(Object(S)) != '{}';
});
if (!useNative) {
  $Symbol = function Symbol() {
    if (isSymbol(this))
      throw TypeError('Symbol is not a constructor');
    return wrap(uid(arguments.length > 0 ? arguments[0] : undefined));
  };
  redefine($Symbol.prototype, 'toString', function toString() {
    return this._k;
  });
  isSymbol = function(it) {
    return it instanceof $Symbol;
  };
  $.create = $create;
  $.isEnum = $propertyIsEnumerable;
  $.getDesc = $getOwnPropertyDescriptor;
  $.setDesc = $defineProperty;
  $.setDescs = $defineProperties;
  $.getNames = $names.get = $getOwnPropertyNames;
  $.getSymbols = $getOwnPropertySymbols;
  if (DESCRIPTORS && !require('./$.library')) {
    redefine(ObjectProto, 'propertyIsEnumerable', $propertyIsEnumerable, true);
  }
}
var symbolStatics = {
  'for': function(key) {
    return has(SymbolRegistry, key += '') ? SymbolRegistry[key] : SymbolRegistry[key] = $Symbol(key);
  },
  keyFor: function keyFor(key) {
    return keyOf(SymbolRegistry, key);
  },
  useSetter: function() {
    setter = true;
  },
  useSimple: function() {
    setter = false;
  }
};
$.each.call(('hasInstance,isConcatSpreadable,iterator,match,replace,search,' + 'species,split,toPrimitive,toStringTag,unscopables').split(','), function(it) {
  var sym = wks(it);
  symbolStatics[it] = useNative ? sym : wrap(sym);
});
setter = true;
$export($export.G + $export.W, {Symbol: $Symbol});
$export($export.S, 'Symbol', symbolStatics);
$export($export.S + $export.F * !useNative, 'Object', {
  create: $create,
  defineProperty: $defineProperty,
  defineProperties: $defineProperties,
  getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
  getOwnPropertyNames: $getOwnPropertyNames,
  getOwnPropertySymbols: $getOwnPropertySymbols
});
$JSON && $export($export.S + $export.F * (!useNative || buggyJSON), 'JSON', {stringify: $stringify});
setToStringTag($Symbol, 'Symbol');
setToStringTag(Math, 'Math', true);
setToStringTag(global.JSON, 'JSON', true);
