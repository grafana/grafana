# core-js

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/zloirock/core-js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![version](https://img.shields.io/npm/v/core-js.svg)](https://www.npmjs.com/package/core-js) [![npm downloads](https://img.shields.io/npm/dm/core-js.svg)](http://npm-stat.com/charts.html?package=core-js&author=&from=2014-11-18&to=2114-11-18) [![Build Status](https://travis-ci.org/zloirock/core-js.png)](https://travis-ci.org/zloirock/core-js) [![devDependency Status](https://david-dm.org/zloirock/core-js/dev-status.svg)](https://david-dm.org/zloirock/core-js#info=devDependencies)

Modular compact standard library for JavaScript. Includes polyfills for [ECMAScript 5](#ecmascript-5), [ECMAScript 6](#ecmascript-6): [symbols](#ecmascript-6-symbol), [collections](#ecmascript-6-collections), [iterators](#ecmascript-6-iterators), [promises](#ecmascript-6-promise), [ECMAScript 7 proposals](#ecmascript-7); [setImmediate](#setimmediate), [array generics](#mozilla-javascript-array-generics). Some additional features such as [dictionaries](#dict) or [extended partial application](#partial-application). You can require only standardized features polyfills, use features without global namespace pollution or create a custom build.

[Example](http://goo.gl/mfHYm2):
```javascript
Array.from(new Set([1, 2, 3, 2, 1])); // => [1, 2, 3]
'*'.repeat(10);                       // => '**********'
Promise.resolve(32).then(log);        // => 32
setImmediate(log, 42);                // => 42
```

[Without global namespace pollution](http://goo.gl/WBhs43):
```javascript
var core = require('core-js/library'); // With a modular system, otherwise use global `core`
core.Array.from(new core.Set([1, 2, 3, 2, 1])); // => [1, 2, 3]
core.String.repeat('*', 10);                    // => '**********'
core.Promise.resolve(32).then(core.log);        // => 32
core.setImmediate(core.log, 42);                // => 42
```

- [Usage](#usage)
  - [Basic](#basic)
  - [CommonJS](#commonjs)
  - [Custom build](#custom-build)
- [Features](#features)
  - [ECMAScript 5](#ecmascript-5)
  - [ECMAScript 6](#ecmascript-6)
    - [ECMAScript 6: Object](#ecmascript-6-object)
    - [ECMAScript 6: Function](#ecmascript-6-function)
    - [ECMAScript 6: Array](#ecmascript-6-array)
    - [ECMAScript 6: String](#ecmascript-6-string)
    - [ECMAScript 6: RegExp](#ecmascript-6-regexp)
    - [ECMAScript 6: Number](#ecmascript-6-number)
    - [ECMAScript 6: Math](#ecmascript-6-math)
    - [ECMAScript 6: Symbol](#ecmascript-6-symbol)
    - [ECMAScript 6: Collections](#ecmascript-6-collections)
    - [ECMAScript 6: Iterators](#ecmascript-6-iterators)
    - [ECMAScript 6: Promise](#ecmascript-6-promise)
    - [ECMAScript 6: Reflect](#ecmascript-6-reflect)
  - [ECMAScript 7](#ecmascript-7)
  - [Mozilla JavaScript: Array generics](#mozilla-javascript-array-generics)
  - [Web standards](#web-standards)
    - [setTimeout / setInterval](#settimeout--setinterval)
    - [setImmediate](#setimmediate)
  - [Non-standard](#non-standard)
    - [Object](#object)
    - [Dict](#dict)
    - [Partial application](#partial-application)
    - [Number Iterator](#number-iterator)
    - [Escaping HTML](#escaping-html)
    - [delay](#delay)
    - [console](#console)
- [Missing polyfills](#missing-polyfills)
- [Changelog](./CHANGELOG.md)

## Usage
### Basic
```
npm i core-js
bower install core.js
```

```javascript
// Default
require('core-js');
// Without global namespace pollution
var core = require('core-js/library');
// Shim only
require('core-js/shim');
```
If you need complete build for browser, use builds from `core-js/client` path:  [default](https://raw.githack.com/zloirock/core-js/master/client/core.min.js), [without global namespace pollution](https://raw.githack.com/zloirock/core-js/master/client/library.min.js), [shim only](https://raw.githack.com/zloirock/core-js/master/client/shim.min.js).

Warning: if you uses `core-js` with the extension of native objects, require all needed `core-js` modules at the beginning of entry point of your application, otherwise maybe conflicts.

### CommonJS
You can require only needed modules.

```js
require('core-js/es5'); // if you need support IE8-
require('core-js/fn/set');
require('core-js/fn/array/from');
require('core-js/fn/array/find-index');
Array.from(new Set([1, 2, 3, 2, 1])); // => [1, 2, 3]
[1, 2, NaN, 3, 4].findIndex(isNaN);   // => 2

// or, w/o global namespace pollution:

var core      = require('core-js/library/es5'); // if you need support IE8-
var Set       = require('core-js/library/fn/set');
var from      = require('core-js/library/fn/array/from');
var findIndex = require('core-js/library/fn/array/find-index');
from(new Set([1, 2, 3, 2, 1]));      // => [1, 2, 3]
findIndex([1, 2, NaN, 3, 4], isNaN); // => 2
```
Available entry points for methods / constructors, as above examples, excluding features from [`es5`](#ecmascript-5) module (this module requires completely in ES3 environment before all other modules).

Available namespaces: for example, `core-js/es6/array` (`core-js/library/es6/array`) contains all [ES6 `Array` features](#ecmascript-6-array), `core-js/es6` (`core-js/library/es6`) contains all ES6 features.

### Custom build
```
npm i core-js && cd node_modules/core-js && npm i
npm run grunt build:core.dict,es6 -- --blacklist=es6.promise,es6.math --library=on --path=custom uglify
```
Where `core.dict` and `es6` are modules (namespaces) names, which will be added to the build, `es6.promise` and `es6.math` are modules (namespaces) names, which will be excluded from the build, `--library=on` is flag for build without global namespace pollution and `custom` is target file name.

Available namespaces: for example, `es6.array` contains [ES6 `Array` features](#ecmascript-6-array), `es6` contains all modules whose names start with `es6`.

Available custom build from js code (required `webpack`):
```js
require('core-js/build')({
  modules: ['es6', 'core.dict'], // modules / namespaces
  blacklist: ['es6.reflect'],    // blacklist of modules / namespaces
  library: false,                // flag for build without global namespace pollution
}, function(err, code){          // callback
  // ...
});
```
## Features:
### ECMAScript 5
Module [`es5`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es5.js), nothing new - without examples.
```javascript
Object
  .create(proto | null, descriptors?) -> object
  .getPrototypeOf(object) -> proto | null
  .defineProperty(target, key, desc) -> target, cap for ie8-
  .defineProperties(target, descriptors) -> target, cap for ie8-
  .getOwnPropertyDescriptor(object, key) -> desc
  .getOwnPropertyNames(object) -> array
  .keys(object) -> array
Array
  .isArray(var) -> bool
  #slice(start?, end?) -> array, fix for ie7-
  #join(string = ',') -> string, fix for ie7-
  #indexOf(var, from?) -> int
  #lastIndexOf(var, from?) -> int
  #every(fn(val, index, @), that) -> bool
  #some(fn(val, index, @), that) -> bool
  #forEach(fn(val, index, @), that) -> void
  #map(fn(val, index, @), that) -> array
  #filter(fn(val, index, @), that) -> array
  #reduce(fn(memo, val, index, @), memo?) -> var
  #reduceRight(fn(memo, val, index, @), memo?) -> var
Function
  #bind(object, ...args) -> boundFn(...args)
Date
  .now() -> int
  #toISOString() -> string
```
Some features moved to [another modules / namespaces](#ecmascript-6), but available as part of `es5` namespace too:
```js
Object
  .seal(object) -> object, cap for ie8-
  .freeze(object) -> object, cap for ie8-
  .preventExtensions(object) -> object, cap for ie8-
  .isSealed(object) -> bool, cap for ie8-
  .isFrozen(object) -> bool, cap for ie8-
  .isExtensible(object) -> bool, cap for ie8-
String
  #trim() -> str
```

### ECMAScript 6
#### ECMAScript 6: Object
Modules [`es6.object.assign`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.assign.js), [`es6.object.is`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.is.js), [`es6.object.set-prototype-of`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.set-prototype-of.js) and [`es6.object.to-string`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.to-string.js).
```javascript
Object
  .assign(target, ...src) -> target
  .is(a, b) -> bool
  .setPrototypeOf(target, proto | null) -> target (required __proto__ - IE11+)
  #toString() -> string, ES6 fix: @@toStringTag support
```
[Example](http://goo.gl/VzmY3j):
```javascript
var foo = {q: 1, w: 2}
  , bar = {e: 3, r: 4}
  , baz = {t: 5, y: 6};
Object.assign(foo, bar, baz); // => foo = {q: 1, w: 2, e: 3, r: 4, t: 5, y: 6}

Object.is(NaN, NaN); // => true
Object.is(0, -0);    // => false
Object.is(42, 42);   // => true
Object.is(42, '42'); // => false

function Parent(){}
function Child(){}
Object.setPrototypeOf(Child.prototype, Parent.prototype);
new Child instanceof Child;  // => true
new Child instanceof Parent; // => true

var O = {};
O[Symbol.toStringTag] = 'Foo';
'' + O; // => '[object Foo]'
```
In ES6 most `Object` static methods should work with primitives. Modules [`es6.object.freeze`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.freeze.js), [`es6.object.seal`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.seal.js), [`es6.object.prevent-extensions`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.prevent-extensions.js), [`es6.object.is-frozen`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.is-frozen.js), [`es6.object.is-sealed`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.is-sealed.js), [`es6.object.is-extensible`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.is-extensible.js), [`es6.object.get-own-property-descriptor`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.get-own-property-descriptor.js), [`es6.object.get-prototype-of`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.get-prototype-of.js), [`es6.object.keys`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.keys.js), [`es6.object.get-own-property-names`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.object.get-own-property-names.js).
```javascript
Object
  .freeze(var) -> var
  .seal(var) -> var
  .preventExtensions(var) -> var
  .isFrozen(var) -> bool
  .isSealed(var) -> bool
  .isExtensible(var) -> bool
  .getOwnPropertyDescriptor(var, key) -> desc | undefined
  .getPrototypeOf(var) -> object | null
  .keys(var) -> array
  .getOwnPropertyNames(var) -> array
```
[Example](http://goo.gl/35lPSi):
```javascript
Object.keys('qwe'); // => ['0', '1', '2']
Object.getPrototypeOf('qwe') === String.prototype; // => true
```
#### ECMAScript 6: Function
Modules [`es6.function.name`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.function.name.js) and [`es6.function.has-instance`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.function.has-instance.js).
```javascript
Function
  #name -> string (IE9+)
  #@@hasInstance(var) -> bool
```
[Example](http://goo.gl/zqu3Wp):
```javascript
(function foo(){}).name // => 'foo'
```
#### ECMAScript 6: Array
Modules [`es6.array.from`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.array.from.js), [`es6.array.of`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.array.of.js), [`es6.array.copy-within`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.array.copy-within.js), [`es6.array.fill`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.array.fill.js), [`es6.array.find`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.array.find.js) and [`es6.array.find-index`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.array.find-index.js).
```javascript
Array
  .from(iterable | array-like, mapFn(val, index)?, that) -> array
  .of(...args) -> array
  #copyWithin(target = 0, start = 0, end = @length) -> @
  #fill(val, start = 0, end = @length) -> @
  #find(fn(val, index, @), that) -> val
  #findIndex(fn(val, index, @), that) -> index
  #@@unscopables -> object (cap)
```
[Example](http://goo.gl/nxmJTe):
```javascript
Array.from(new Set([1, 2, 3, 2, 1]));      // => [1, 2, 3]
Array.from({0: 1, 1: 2, 2: 3, length: 3}); // => [1, 2, 3]
Array.from('123', Number);                 // => [1, 2, 3]
Array.from('123', function(it){
  return it * it;
});                                        // => [1, 4, 9]

Array.of(1);       // => [1]
Array.of(1, 2, 3); // => [1, 2, 3]

function isOdd(val){
  return val % 2;
}
[4, 8, 15, 16, 23, 42].find(isOdd);      // => 15
[4, 8, 15, 16, 23, 42].findIndex(isOdd); // => 2
[4, 8, 15, 16, 23, 42].find(isNaN);      // => undefined
[4, 8, 15, 16, 23, 42].findIndex(isNaN); // => -1

Array(5).fill(42); // => [42, 42, 42, 42, 42]

[1, 2, 3, 4, 5].copyWithin(0, 3); // => [4, 5, 3, 4, 5]
```
#### ECMAScript 6: String
Modules [`es6.string.from-code-point`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.from-code-point.js), [`es6.string.raw`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.raw.js), [`es6.string.code-point-at`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.code-point-at.js), [`es6.string.ends-with`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.ends-with.js), [`es6.string.includes`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.includes.js), [`es6.string.repeat`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.repeat.js), [`es6.string.starts-with`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.starts-with.js) and [`es6.string.trim`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.trim.js).
```javascript
String
  .fromCodePoint(...codePoints) -> str
  .raw({raw}, ...substitutions) -> str
  #includes(str, from?) -> bool
  #startsWith(str, from?) -> bool
  #endsWith(str, from?) -> bool
  #repeat(num) -> str
  #codePointAt(pos) -> uint
  #trim() -> str, ES6 fix
```
[Examples](http://goo.gl/RMyFBo):
```javascript
'foobarbaz'.includes('bar');      // => true
'foobarbaz'.includes('bar', 4);   // => false
'foobarbaz'.startsWith('foo');    // => true
'foobarbaz'.startsWith('bar', 3); // => true
'foobarbaz'.endsWith('baz');      // => true
'foobarbaz'.endsWith('bar', 6);   // => true

'string'.repeat(3); // => 'stringstringstring'

'𠮷'.codePointAt(0); // => 134071
String.fromCodePoint(97, 134071, 98); // => 'a𠮷b'

var name = 'Bob';
String.raw`Hi\n${name}!`;           // => 'Hi\\nBob!' (ES6 template string syntax)
String.raw({raw: 'test'}, 0, 1, 2); // => 't0e1s2t'
```
#### ECMAScript 6: RegExp
Modules [`es6.regexp.constructor`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.regexp.constructor.js) and [`es6.regexp.flags`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.regexp.flags.js).

Support well-known [symbols](#ecmascript-6-symbol) `@@match`, `@@replace`, `@@search` and `@@split`, modules [`es6.regexp.match`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.regexp.match.js), [`es6.regexp.replace`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.regexp.replace.js), [`es6.regexp.search`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.regexp.search.js) and [`es6.regexp.split`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.regexp.split.js).
```
String
  #match(tpl) -> var, ES6 fix for support @@match
  #replace(tpl, replacer) -> var, ES6 fix for support @@replace
  #search(tpl) -> var, ES6 fix for support @@search
  #split(tpl, limit) -> var, ES6 fix for support @@split
[new] RegExp(pattern, flags?) -> regexp, ES6 fix: can alter flags (IE9+)
  #flags -> str (IE9+)
  #@@match(str) -> array | null
  #@@replace(str, replacer) -> string
  #@@search(str) -> index
  #@@split(str, limit) -> array
```
[Examples](http://goo.gl/vLV603):
```javascript
RegExp(/./g, 'm'); // => /./m

/foo/.flags;    // => ''
/foo/gim.flags; // => 'gim'

'foo'.match({[Symbol.match]: _ => 1});     // => 1
'foo'.replace({[Symbol.replace]: _ => 2}); // => 2
'foo'.search({[Symbol.search]: _ => 3});   // => 3
'foo'.split({[Symbol.split]: _ => 4});     // => 4
```
#### ECMAScript 6: Number
Module [`es6.number.constructor`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.constructor.js). `Number` constructor support binary and octal literals, [example](http://goo.gl/jRd6b3):
```javascript
Number('0b1010101'); // => 85
Number('0o7654321'); // => 2054353
```
`Number`: modules [`es6.number.epsilon`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.epsilon.js), [`es6.number.is-finite`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.is-finite.js), [`es6.number.is-integer`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.is-integer.js), [`es6.number.is-nan`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.is-nan.js), [`es6.number.is-safe-integer`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.is-safe-integer.js), [`es6.number.max-safe-integer`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.max-safe-integer.js), [`es6.number.min-safe-integer`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.min-safe-integer.js), [`es6.number.parse-float`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.parse-float.js), [`es6.number.parse-int`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.number.parse-int.js).
```javascript
[new] Number(var) -> number | number object
  .EPSILON -> num
  .isFinite(num) -> bool
  .isInteger(num) -> bool
  .isNaN(num) -> bool
  .isSafeInteger(num) -> bool
  .MAX_SAFE_INTEGER -> int
  .MIN_SAFE_INTEGER -> int
  .parseFloat(str) -> num
  .parseInt(str) -> int
```
#### ECMAScript 6: Math
`Math`: modules [`es6.math.acosh`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.acosh.js), [`es6.math.asinh`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.asinh.js), [`es6.math.atanh`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.atanh.js), [`es6.math.cbrt`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.cbrt.js), [`es6.math.clz32`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.clz32.js), [`es6.math.cosh`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.cosh.js), [`es6.math.expm1`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.expm1.js), [`es6.math.fround`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.fround.js), [`es6.math.hypot`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.hypot.js), [`es6.math.imul`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.imul.js), [`es6.math.log10`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.log10.js), [`es6.math.log1p`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.log1p.js), [`es6.math.log2`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.log2.js), [`es6.math.sign`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.sign.js), [`es6.math.sinh`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.sinh.js), [`es6.math.tanh`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.tanh.js), [`es6.math.trunc`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.math.trunc.js).
```javascript
Math
  .acosh(num) -> num
  .asinh(num) -> num
  .atanh(num) -> num
  .cbrt(num) -> num
  .clz32(num) -> uint
  .cosh(num) -> num
  .expm1(num) -> num
  .fround(num) -> num
  .hypot(...args) -> num
  .imul(num, num) -> int
  .log1p(num) -> num
  .log10(num) -> num
  .log2(num) -> num
  .sign(num) -> 1 | -1 | 0 | -0 | NaN
  .sinh(num) -> num
  .tanh(num) -> num
  .trunc(num) -> num
```

#### ECMAScript 6: Symbol
Module [`es6.symbol`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.symbol.js).
```javascript
Symbol(description?) -> symbol
  .hasInstance -> @@hasInstance
  .isConcatSpreadable -> @@isConcatSpreadable
  .iterator -> @@iterator
  .match -> @@match
  .replace -> @@replace
  .search -> @@search
  .species -> @@species
  .split -> @@split
  .toPrimitive -> @@toPrimitive
  .toStringTag -> @@toStringTag
  .unscopables -> @@unscopables
  .for(key) -> symbol
  .keyFor(symbol) -> key
  .useSimple() -> void
  .useSetter() -> void
Object
  .getOwnPropertySymbols(object) -> array
```
Also wrapped some methods for correct work with `Symbol` polyfill.
```js
Object
  .create(proto | null, descriptors?) -> object
  .defineProperty(target, key, desc) -> target
  .defineProperties(target, descriptors) -> target
  .getOwnPropertyDescriptor(var, key) -> desc | undefined
  .getOwnPropertyNames(var) -> array
  #propertyIsEnumerable(key) -> bool
JSON
  .stringify(target, replacer?, space?) -> string | undefined
```
[Basic example](http://goo.gl/BbvWFc):
```javascript
var Person = (function(){
  var NAME = Symbol('name');
  function Person(name){
    this[NAME] = name;
  }
  Person.prototype.getName = function(){
    return this[NAME];
  };
  return Person;
})();

var person = new Person('Vasya');
log(person.getName());          // => 'Vasya'
log(person['name']);            // => undefined
log(person[Symbol('name')]);    // => undefined, symbols are uniq
for(var key in person)log(key); // => only 'getName', symbols are not enumerable
```
`Symbol.for` & `Symbol.keyFor` [example](http://goo.gl/0pdJjX):
```javascript
var symbol = Symbol.for('key');
symbol === Symbol.for('key'); // true
Symbol.keyFor(symbol);        // 'key'
```
[Example](http://goo.gl/mKVOQJ) with methods for getting own object keys:
```javascript
var O = {a: 1};
Object.defineProperty(O, 'b', {value: 2});
O[Symbol('c')] = 3;
Object.keys(O);                  // => ['a']
Object.getOwnPropertyNames(O);   // => ['a', 'b']
Object.getOwnPropertySymbols(O); // => [Symbol(c)]
Reflect.ownKeys(O);              // => ['a', 'b', Symbol(c)]
```
#### Caveats when using `Symbol` polyfill:

* We can't add new primitive type, `Symbol` returns object.
* `Symbol.for` and `Symbol.keyFor` can't be shimmed cross-realm.
* By default, to hide the keys, `Symbol` polyfill defines setter in `Object.prototype`. For this reason, uncontrolled creation of symbols can cause memory leak and the `in` operator is not working correctly with `Symbol` polyfill: `Symbol() in {} // => true`.

You can disable defining setters in `Object.prototype`. [Example](http://goo.gl/N5UD7J):
```javascript
Symbol.useSimple();
var s1 = Symbol('s1')
  , o1 = {};
o1[s1] = true;
for(var key in o1)log(key); // => 'Symbol(s1)_t.qamkg9f3q', w/o native Symbol

Symbol.useSetter();
var s2 = Symbol('s2')
  , o2 = {};
o2[s2] = true;
for(var key in o2)log(key); // nothing
```
* Currently, `core-js` not adds setters to `Object.prototype` for well-known symbols for correct work something like `Symbol.iterator in foo`. It can cause problems with their enumerability.

#### ECMAScript 6: Collections
`core-js` uses native collections in most case, just fixes methods / constructor, if it's required, and in old environment uses fast polyfill (O(1) lookup).
#### Map
Module [`es6.map`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.map.js). About iterators from this module [here](#ecmascript-6-iterators).
```javascript
new Map(iterable (entries) ?) -> map
  #clear() -> void
  #delete(key) -> bool
  #forEach(fn(val, key, @), that) -> void
  #get(key) -> val
  #has(key) -> bool
  #set(key, val) -> @
  #size -> uint
```
[Example](http://goo.gl/RDbROF):
```javascript
var a = [1];

var map = new Map([['a', 1], [42, 2]]);
map.set(a, 3).set(true, 4);

log(map.size);        // => 4
log(map.has(a));      // => true
log(map.has([1]));    // => false
log(map.get(a));      // => 3
map.forEach(function(val, key){
  log(val);           // => 1, 2, 3, 4
  log(key);           // => 'a', 42, [1], true
});
map.delete(a);
log(map.size);        // => 3
log(map.get(a));      // => undefined
log(Array.from(map)); // => [['a', 1], [42, 2], [true, 4]]
```
#### Set
Module [`es6.set`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.set.js). About iterators from this module [here](#ecmascript-6-iterators).
```javascript
new Set(iterable?) -> set
  #add(key) -> @
  #clear() -> void
  #delete(key) -> bool
  #forEach(fn(el, el, @), that) -> void
  #has(key) -> bool
  #size -> uint
```
[Example](http://goo.gl/7XYya3):
```javascript
var set = new Set(['a', 'b', 'a', 'c']);
set.add('d').add('b').add('e');
log(set.size);        // => 5
log(set.has('b'));    // => true
set.forEach(function(it){
  log(it);            // => 'a', 'b', 'c', 'd', 'e'
});
set.delete('b');
log(set.size);        // => 4
log(set.has('b'));    // => false
log(Array.from(set)); // => ['a', 'c', 'd', 'e']
```
#### WeakMap
Module [`es6.weak-map`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.weak-map.js).
```javascript
new WeakMap(iterable (entries) ?) -> weakmap
  #delete(key) -> bool
  #get(key) -> val
  #has(key) -> bool
  #set(key, val) -> @
```
[Example](http://goo.gl/SILXyw):
```javascript
var a = [1]
  , b = [2]
  , c = [3];

var wmap = new WeakMap([[a, 1], [b, 2]]);
wmap.set(c, 3).set(b, 4);
log(wmap.has(a));   // => true
log(wmap.has([1])); // => false
log(wmap.get(a));   // => 1
wmap.delete(a);
log(wmap.get(a));   // => undefined

// Private properties store:
var Person = (function(){
  var names = new WeakMap;
  function Person(name){
    names.set(this, name);
  }
  Person.prototype.getName = function(){
    return names.get(this);
  };
  return Person;
})();

var person = new Person('Vasya');
log(person.getName());          // => 'Vasya'
for(var key in person)log(key); // => only 'getName'
```
#### WeakSet
Module [`es6.weak-set`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.weak-set.js).
```javascript
new WeakSet(iterable?) -> weakset
  #add(key) -> @
  #delete(key) -> bool
  #has(key) -> bool
```
[Example](http://goo.gl/TdFbEx):
```javascript
var a = [1]
  , b = [2]
  , c = [3];

var wset = new WeakSet([a, b, a]);
wset.add(c).add(b).add(c);
log(wset.has(b));   // => true
log(wset.has([2])); // => false
wset.delete(b);
log(wset.has(b));   // => false
```
#### Caveats when using collections polyfill:

* Frozen objects as collection keys are supported, but not recomended - it's slow (O(n) instead of O(1)) and, for weak-collections, leak.
* Weak-collections polyfill stores values as hidden properties of keys. It works correct and not leak in most cases. However, it is desirable to store a collection longer than its keys.

#### ECMAScript 6: Iterators
Modules [`es6.string.iterator`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.string.iterator.js) and [`es6.array.iterator`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.array.iterator.js):
```javascript
String
  #@@iterator() -> iterator
Array
  #values() -> iterator
  #keys() -> iterator
  #entries() -> iterator (entries)
  #@@iterator() -> iterator
Arguments
  #@@iterator() -> iterator (available only in core-js methods)
```
Modules [`es6.map`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.map.js) and [`es6.set`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.set.js):
```javascript
Map
  #values() -> iterator
  #keys() -> iterator
  #entries() -> iterator (entries)
  #@@iterator() -> iterator (entries)
Set
  #values() -> iterator
  #keys() -> iterator
  #entries() -> iterator (entries)
  #@@iterator() -> iterator
```
Module [`web.dom.iterable`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/web.dom.iterable.js):
```javascript
NodeList
  #@@iterator() -> iterator
```
[Example](http://goo.gl/nzHVQF):
```javascript
var string = 'a𠮷b';

for(var val of string)log(val);         // => 'a', '𠮷', 'b'

var array = ['a', 'b', 'c'];

for(var val of array)log(val);          // => 'a', 'b', 'c'
for(var val of array.values())log(val); // => 'a', 'b', 'c'
for(var key of array.keys())log(key);   // => 0, 1, 2
for(var [key, val] of array.entries()){
  log(key);                             // => 0, 1, 2
  log(val);                             // => 'a', 'b', 'c'
}

var map = new Map([['a', 1], ['b', 2], ['c', 3]]);

for(var [key, val] of map){
  log(key);                             // => 'a', 'b', 'c'
  log(val);                             // => 1, 2, 3
}
for(var val of map.values())log(val);   // => 1, 2, 3
for(var key of map.keys())log(key);     // => 'a', 'b', 'c'
for(var [key, val] of map.entries()){
  log(key);                             // => 'a', 'b', 'c'
  log(val);                             // => 1, 2, 3
}

var set = new Set([1, 2, 3, 2, 1]);

for(var val of set)log(val);            // => 1, 2, 3
for(var val of set.values())log(val);   // => 1, 2, 3
for(var key of set.keys())log(key);     // => 1, 2, 3
for(var [key, val] of set.entries()){
  log(key);                             // => 1, 2, 3
  log(val);                             // => 1, 2, 3
}

for(var x of document.querySelectorAll('*')){
  log(x.id);
}
```
Modules [`core.is-iterable`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.is-iterable.js), [`core.get-iterator`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.get-iterator.js), [`core.get-iterator-method`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.get-iterator-method.js) - helpers for check iterable / get iterator in `library` version or, for example, for `arguments` object:
```javascript
core
  .isIterable(var) -> bool
  .getIterator(iterable) -> iterator
  .getIteratorMethod(var) -> function | undefined
```
[Example](http://goo.gl/SXsM6D):
```js
var list = (function(){
  return arguments;
})(1, 2, 3);

log(core.isIterable(list)); // true;

var iter = core.getIterator(list);
log(iter.next().value); // 1
log(iter.next().value); // 2
log(iter.next().value); // 3
log(iter.next().value); // undefined

core.getIterator({});   // TypeError: [object Object] is not iterable!

var iterFn = core.getIteratorMethod(list);
log(typeof iterFn);     // 'function'
var iter = iterFn.call(list);
log(iter.next().value); // 1
log(iter.next().value); // 2
log(iter.next().value); // 3
log(iter.next().value); // undefined

log(core.getIteratorMethod({})); // undefined
```
#### ECMAScript 6: Promise
Module [`es6.promise`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.promise.js).
```javascript
new Promise(executor(resolve(var), reject(var))) -> promise
  #then(resolved(var), rejected(var)) -> promise
  #catch(rejected(var)) -> promise
  .resolve(var || promise) -> promise
  .reject(var) -> promise
  .all(iterable) -> promise
  .race(iterable) -> promise
```
Basic [example](http://goo.gl/vGrtUC):
```javascript
function sleepRandom(time){
  return new Promise(function(resolve, reject){
    setTimeout(resolve, time * 1e3, 0 | Math.random() * 1e3);
  });
}

log('Run');                    // => Run
sleepRandom(5).then(function(result){
  log(result);                 // => 869, after 5 sec.
  return sleepRandom(10);
}).then(function(result){
  log(result);                 // => 202, after 10 sec.
}).then(function(){
  log('immediately after');    // => immediately after
  throw Error('Irror!');
}).then(function(){
  log('will not be displayed');
}).catch(log);                 // => => Error: Irror!
```
`Promise.resolve` and `Promise.reject` [example](http://goo.gl/vr8TN3):
```javascript
Promise.resolve(42).then(log); // => 42
Promise.reject(42).catch(log); // => 42

Promise.resolve($.getJSON('/data.json')); // => ES6 promise
```
`Promise.all` [example](http://goo.gl/RdoDBZ):
```javascript
Promise.all([
  'foo',
  sleepRandom(5),
  sleepRandom(15),
  sleepRandom(10)  // after 15 sec:
]).then(log);      // => ['foo', 956, 85, 382]
```
`Promise.race` [example](http://goo.gl/L8ovkJ):
```javascript
function timeLimit(promise, time){
  return Promise.race([promise, new Promise(function(resolve, reject){
    setTimeout(reject, time * 1e3, Error('Await > ' + time + ' sec'));
  })]);
}

timeLimit(sleepRandom(5), 10).then(log);   // => 853, after 5 sec.
timeLimit(sleepRandom(15), 10).catch(log); // Error: Await > 10 sec
```
ECMAScript 7 [async functions](https://tc39.github.io/ecmascript-asyncawait) [example](http://goo.gl/wnQS4j):
```javascript
var delay = time => new Promise(resolve => setTimeout(resolve, time))

async function sleepRandom(time){
  await delay(time * 1e3);
  return 0 | Math.random() * 1e3;
};
async function sleepError(time, msg){
  await delay(time * 1e3);
  throw Error(msg);
};

(async () => {
  try {
    log('Run');                // => Run
    log(await sleepRandom(5)); // => 936, after 5 sec.
    var [a, b, c] = await Promise.all([
      sleepRandom(5),
      sleepRandom(15),
      sleepRandom(10)
    ]);
    log(a, b, c);              // => 210 445 71, after 15 sec.
    await sleepError(5, 'Irror!');
    log('Will not be displayed');
  } catch(e){
    log(e);                    // => Error: 'Irror!', after 5 sec.
  }
})();
```

##### Unhandled rejection tracking

`core-js` `Promise` supports (but not adds to native implementations) unhandled rejection tracking.

[Node.js](https://gist.github.com/benjamingr/0237932cee84712951a2):
```js
process.on('unhandledRejection', (reason, promise) => console.log(reason, promise));
Promise.reject(42);
// 42 [object Promise]

```
In a browser, by default, you will see notify in the console, or you can add a custom handler, [example](http://goo.gl/izTr2I):
```js
window.onunhandledrejection = e => log(e.reason, e.promise);
Promise.reject(42);
// 42 [object Promise]
```
**Warning**: The problem here - we can't add it to native `Promise` implementations, but by idea `core-js` should use enough correct native implementation if it's available. Currently, most native implementations are buggy and `core-js` uses polyfill, but the situation will be changed. If someone wanna use this hook everywhere - he should delete `window.Promise` before inclusion `core-js`.


#### ECMAScript 6: Reflect
Modules [`es6.reflect.apply`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.apply.js), [`es6.reflect.construct`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.construct.js), [`es6.reflect.define-property`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.define-property.js), [`es6.reflect.delete-property`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.delete-property.js), [`es6.reflect.enumerate`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.enumerate.js), [`es6.reflect.get`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.get.js), [`es6.reflect.get-own-property-descriptor`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.get-own-property-descriptor.js), [`es6.reflect.get-prototype-of`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.get-prototype-of.js), [`es6.reflect.has`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.has.js), [`es6.reflect.is-extensible`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.is-extensible.js), [`es6.reflect.own-keys`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.own-keys.js), [`es6.reflect.prevent-extensions`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.prevent-extensions.js), [`es6.reflect.set`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.set.js), [`es6.reflect.set-prototype-of`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es6.reflect.set-prototype-of.js).
```javascript
Reflect
  .apply(target, thisArgument, argumentsList) -> var
  .construct(target, argumentsList, newTarget?) -> object
  .defineProperty(target, propertyKey, attributes) -> bool
  .deleteProperty(target, propertyKey) -> bool
  .enumerate(target) -> iterator
  .get(target, propertyKey, receiver?) -> var
  .getOwnPropertyDescriptor(target, propertyKey) -> desc
  .getPrototypeOf(target) -> object | null
  .has(target, propertyKey) -> bool
  .isExtensible(target) -> bool
  .ownKeys(target) -> array
  .preventExtensions(target) -> bool
  .set(target, propertyKey, V, receiver?) -> bool
  .setPrototypeOf(target, proto) -> bool (required __proto__ - IE11+)
```
[Example](http://goo.gl/gVT0cH):
```javascript
var O = {a: 1};
Object.defineProperty(O, 'b', {value: 2});
O[Symbol('c')] = 3;
Reflect.ownKeys(O); // => ['a', 'b', Symbol(c)]

function C(a, b){
  this.c = a + b;
}

var instance = Reflect.construct(C, [20, 22]);
instance.c; // => 42
```
### ECMAScript 7
* `Array#includes` [proposal](https://github.com/domenic/Array.prototype.includes) - module [`es7.array.includes`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.array.includes.js)
* `String#at` [proposal](https://github.com/mathiasbynens/String.prototype.at) - module [`es7.string.at`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.string.at.js)
* `String#padLeft`, `String#padRight` [proposal](https://github.com/ljharb/proposal-string-pad-left-right) - modules [`es7.string.pad-left`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.string.pad-left.js), [`es7.string.pad-right`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.string.pad-right.js)
* `String#trimLeft`, `String#trimRight` [proposal](https://github.com/sebmarkbage/ecmascript-string-left-right-trim) - modules [`es7.string.trim-left`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.string.trim-right.js), [`es7.string.trim-right`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.string.trim-right.js)
* `Object.values`, `Object.entries` [proposal](https://github.com/ljharb/proposal-object-values-entries) - modules [`es7.object.values`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.object.values.js), [`es7.object.entries`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.object.entries.js)
* `Object.getOwnPropertyDescriptors` [proposal](https://gist.github.com/WebReflection/9353781) - module [`es7.object.get-own-property-descriptors`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.object.get-own-property-descriptors.js)
* `RegExp.escape` [proposal](https://github.com/benjamingr/RexExp.escape) - module [`es7.regexp.escape`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.regexp.escape.js)
* `Map#toJSON`, `Set#toJSON` [proposal](https://github.com/DavidBruant/Map-Set.prototype.toJSON) - modules [`es7.map.to-json`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.map.to-json.js), [`es7.set.to-json`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/es7.set.to-json.js)

```javascript
Array
  #includes(var, from?) -> bool
String
  #at(index) -> string
  #padLeft(length, fillStr = ' ') -> string
  #padRight(length, fillStr = ' ') -> string
  #trimLeft() -> string
  #trimRight() -> string
Object
  .values(object) -> array
  .entries(object) -> array
  .getOwnPropertyDescriptors(object) -> object
RegExp
  .escape(str) -> str
Map
  #toJSON() -> array
Set
  #toJSON() -> array
```
[Examples](http://goo.gl/aUZQRH):
```javascript
[1, 2, 3].includes(2);        // => true
[1, 2, 3].includes(4);        // => false
[1, 2, 3].includes(2, 2);     // => false

[NaN].indexOf(NaN);           // => -1
[NaN].includes(NaN);          // => true
Array(1).indexOf(undefined);  // => -1
Array(1).includes(undefined); // => true

'a𠮷b'.at(1);        // => '𠮷'
'a𠮷b'.at(1).length; // => 2

'hello'.padLeft(10);          // => '     hello'
'hello'.padLeft(10, '1234');  // => '41234hello'
'hello'.padRight(10);         // => 'hello     '
'hello'.padRight(10, '1234'); // => 'hello12341'

'   hello   '.trimLeft();  // => 'hello   '
'   hello   '.trimRight(); // => '   hello'

Object.values({a: 1, b: 2, c: 3});  // => [1, 2, 3]
Object.entries({a: 1, b: 2, c: 3}); // => [['a', 1], ['b', 2], ['c', 3]]

// Shallow object cloning with prototype and descriptors:
var copy = Object.create(Object.getPrototypeOf(O), Object.getOwnPropertyDescriptors(O));
// Mixin:
Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));

RegExp.escape('Hello, []{}()*+?.\\^$|!'); // => 'Hello, \[\]\{\}\(\)\*\+\?\.\\\^\$\|!'

JSON.stringify(new Map([['a', 'b'], ['c', 'd']])); // => '[["a","b"],["c","d"]]'
JSON.stringify(new Set([1, 2, 3, 2, 1]));          // => '[1,2,3]'
```
### Mozilla JavaScript: Array generics
Module [`js.array.statics`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/js.array.statics.js).
```javascript
Array
  .{...ArrayPrototype methods}
```

```javascript
Array.slice(arguments, 1);

Array.join('abcdef', '+'); // => 'a+b+c+d+e+f'

var form = document.getElementsByClassName('form__input');
Array.reduce(form, function(memo, it){
  memo[it.name] = it.value;
  return memo;
}, {}); // => {name: 'Vasya', age: '42', sex: 'yes, please'}
```
### Web standards
#### setTimeout / setInterval
Module [`web.timers`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/web.timers.js). Additional arguments fix for IE9-.
```javascript
setTimeout(fn(...args), time, ...args) -> id
setInterval(fn(...args), time, ...args) -> id
```
```javascript
// Before:
setTimeout(log.bind(null, 42), 1000);
// After:
setTimeout(log, 1000, 42);
```
#### setImmediate
Module [`web.immediate`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/web.immediate.js). [`setImmediate` proposal](https://developer.mozilla.org/en-US/docs/Web/API/Window.setImmediate) polyfill.
```javascript
setImmediate(fn(...args), ...args) -> id
clearImmediate(id) -> void
```
[Example](http://goo.gl/6nXGrx):
```javascript
setImmediate(function(arg1, arg2){
  log(arg1, arg2); // => Message will be displayed with minimum delay
}, 'Message will be displayed', 'with minimum delay');

clearImmediate(setImmediate(function(){
  log('Message will not be displayed');
}));
```
### Non-standard
#### Object
Modules [`core.object.is-object`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.object.is-object.js), [`core.object.classof`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.object.classof.js), [`core.object.define`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.object.define.js), [`core.object.make`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.object.make.js).
```javascript
Object
  .isObject(var) -> bool
  .classof(var) -> string 
  .define(target, mixin) -> target
  .make(proto | null, mixin?) -> object
```
Object classify [examples](http://goo.gl/YZQmGo):
```javascript
Object.isObject({});    // => true
Object.isObject(isNaN); // => true
Object.isObject(null);  // => false

var classof = Object.classof;

classof(null);                 // => 'Null'
classof(undefined);            // => 'Undefined'
classof(1);                    // => 'Number'
classof(true);                 // => 'Boolean'
classof('string');             // => 'String'
classof(Symbol());             // => 'Symbol'

classof(new Number(1));        // => 'Number'
classof(new Boolean(true));    // => 'Boolean'
classof(new String('string')); // => 'String'

var fn   = function(){}
  , list = (function(){return arguments})(1, 2, 3);

classof({});                   // => 'Object'
classof(fn);                   // => 'Function'
classof([]);                   // => 'Array'
classof(list);                 // => 'Arguments'
classof(/./);                  // => 'RegExp'
classof(new TypeError);        // => 'Error'

classof(new Set);              // => 'Set'
classof(new Map);              // => 'Map'
classof(new WeakSet);          // => 'WeakSet'
classof(new WeakMap);          // => 'WeakMap'
classof(new Promise(fn));      // => 'Promise'

classof([].values());          // => 'Array Iterator'
classof(new Set().values());   // => 'Set Iterator'
classof(new Map().values());   // => 'Map Iterator'

classof(Math);                 // => 'Math'
classof(JSON);                 // => 'JSON'

function Example(){}
Example.prototype[Symbol.toStringTag] = 'Example';

classof(new Example);          // => 'Example'
```
`Object.define` and `Object.make` [examples](http://goo.gl/rtpD5Z):
```javascript
// Before:
Object.defineProperty(target, 'c', {
  enumerable: true,
  configurable: true,
  get: function(){
    return this.a + this.b;
  }
});

// After:
Object.define(target, {
  get c(){
    return this.a + this.b;
  }
});

// Shallow object cloning with prototype and descriptors:
var copy = Object.make(Object.getPrototypeOf(src), src);

// Simple inheritance:
function Vector2D(x, y){
  this.x = x;
  this.y = y;
}
Object.define(Vector2D.prototype, {
  get xy(){
    return Math.hypot(this.x, this.y);
  }
});
function Vector3D(x, y, z){
  Vector2D.apply(this, arguments);
  this.z = z;
}
Vector3D.prototype = Object.make(Vector2D.prototype, {
  constructor: Vector3D,
  get xyz(){
    return Math.hypot(this.x, this.y, this.z);
  }
});

var vector = new Vector3D(9, 12, 20);
log(vector.xy);  // => 15
log(vector.xyz); // => 25
vector.y++;
log(vector.xy);  // => 15.811388300841896
log(vector.xyz); // => 25.495097567963924
```
#### Dict
Module [`core.dict`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.dict.js). Based on [TC39 discuss](https://github.com/rwaldron/tc39-notes/blob/master/es6/2012-11/nov-29.md#collection-apis-review) / [strawman](http://wiki.ecmascript.org/doku.php?id=harmony:modules_standard#dictionaries).
```javascript
[new] Dict(iterable (entries) | object ?) -> dict
  .isDict(var) -> bool
  .values(object) -> iterator
  .keys(object) -> iterator
  .entries(object) -> iterator (entries)
  .has(object, key) -> bool
  .get(object, key) -> val
  .set(object, key, value) -> object
  .forEach(object, fn(val, key, @), that) -> void
  .map(object, fn(val, key, @), that) -> new @
  .mapPairs(object, fn(val, key, @), that) -> new @
  .filter(object, fn(val, key, @), that) -> new @
  .some(object, fn(val, key, @), that) -> bool
  .every(object, fn(val, key, @), that) -> bool
  .find(object, fn(val, key, @), that) -> val
  .findKey(object, fn(val, key, @), that) -> key
  .keyOf(object, var) -> key
  .includes(object, var) -> bool
  .reduce(object, fn(memo, val, key, @), memo?) -> var
```
`Dict` create object without prototype from iterable or simple object. [Example](http://goo.gl/pnp8Vr):
```javascript
var map = new Map([['a', 1], ['b', 2], ['c', 3]]);

Dict();                    // => {__proto__: null}
Dict({a: 1, b: 2, c: 3});  // => {__proto__: null, a: 1, b: 2, c: 3}
Dict(map);                 // => {__proto__: null, a: 1, b: 2, c: 3}
Dict([1, 2, 3].entries()); // => {__proto__: null, 0: 1, 1: 2, 2: 3}

var dict = Dict({a: 42});
dict instanceof Object;   // => false
dict.a;                   // => 42
dict.toString;            // => undefined
'a' in dict;              // => true
'hasOwnProperty' in dict; // => false

Dict.isDict({});     // => false
Dict.isDict(Dict()); // => true
```
`Dict.keys`, `Dict.values` and `Dict.entries` returns iterators for objects, [examples](http://goo.gl/xAvECH):
```javascript
var dict = {a: 1, b: 2, c: 3};

for(var key of Dict.keys(dict))log(key); // => 'a', 'b', 'c'

for(var val of Dict.values(dict))log(val); // => 1, 2, 3

for(var [key, val] of Dict.entries(dict)){
  log(key); // => 'a', 'b', 'c'
  log(val); // => 1, 2, 3
}

new Map(Dict.entries(dict)); // => Map {a: 1, b: 2, c: 3}
```
Basic dict operations for objects with prototype [example](http://goo.gl/B28UnG):
```js
'q' in {q: 1};            // => true
'toString' in {};         // => true

Dict.has({q: 1}, 'q');    // => true
Dict.has({}, 'toString'); // => false

({q: 1})['q'];            // => 1
({}).toString;            // => function toString(){ [native code] }

Dict.get({q: 1}, 'q');    // => 1
Dict.get({}, 'toString'); // => undefined

var O = {};
O['q'] = 1;
O['q'];         // => 1
O['__proto__'] = {w: 2};
O['__proto__']; // => {w: 2}
O['w'];         // => 2

var O = {};
Dict.set(O, 'q', 1);
O['q'];         // => 1
Dict.set(O, '__proto__', {w: 2});
O['__proto__']; // => {w: 2}
O['w'];         // => undefined
```
Other methods of `Dict` module are static equialents of `Array.prototype` methods for dictionaries, [examples](http://goo.gl/xFi1RH):
```javascript
var dict = {a: 1, b: 2, c: 3};

Dict.forEach(dict, console.log, console);
// => 1, 'a', {a: 1, b: 2, c: 3}
// => 2, 'b', {a: 1, b: 2, c: 3}
// => 3, 'c', {a: 1, b: 2, c: 3}

Dict.map(dict, function(it){
  return it * it;
}); // => {a: 1, b: 4, c: 9}

Dict.mapPairs(dict, function(val, key){
  if(key != 'b')return [key + key, val * val];
}); // => {aa: 1, cc: 9}

Dict.filter(dict, function(it){
  return it % 2;
}); // => {a: 1, c: 3}

Dict.some(dict, function(it){
  return it === 2;
}); // => true

Dict.every(dict, function(it){
  return it === 2;
}); // => false

Dict.find(dict, function(it){
  return it > 2;
}); // => 3
Dict.find(dict, function(it){
  return it > 4;
}); // => undefined

Dict.findKey(dict, function(it){
  return it > 2;
}); // => 'c'
Dict.findKey(dict, function(it){
  return it > 4;
}); // => undefined

Dict.keyOf(dict, 2);    // => 'b'
Dict.keyOf(dict, 4);    // => undefined

Dict.includes(dict, 2); // => true
Dict.includes(dict, 4); // => false

Dict.reduce(dict, function(memo, it){
  return memo + it;
});     // => 6
Dict.reduce(dict, function(memo, it){
  return memo + it;
}, ''); // => '123'
```
#### Partial application
Module [`core.function.part`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.function.part.js).
```javascript
Function
  #part(...args | _) -> fn(...args)
```
`Function#part` partial apply function without `this` binding. Uses global variable `_` (`core._` for builds without global namespace pollution) as placeholder and not conflict with `Underscore` / `LoDash`. [Examples](http://goo.gl/p9ZJ8K):
```javascript
var fn1 = log.part(1, 2);
fn1(3, 4);    // => 1, 2, 3, 4

var fn2 = log.part(_, 2, _, 4);
fn2(1, 3);    // => 1, 2, 3, 4

var fn3 = log.part(1, _, _, 4);
fn3(2, 3);    // => 1, 2, 3, 4

fn2(1, 3, 5); // => 1, 2, 3, 4, 5
fn2(1);       // => 1, 2, undefined, 4
```
#### Number Iterator
Modules [`core.number.iterator`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.number.iterator.js).
```javascript
Number
  #@@iterator() -> iterator
```
[Examples](http://goo.gl/o45pCN):
```javascript
for(var i of 3)log(i); // => 0, 1, 2

[...10]; // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

Array.from(10, Math.random); // => [0.9817775336559862, 0.02720663254149258, ...]

Array.from(10, function(it){
  return this + it * it;
}, .42); // => [0.42, 1.42, 4.42, 9.42, 16.42, 25.42, 36.42, 49.42, 64.42, 81.42]
```
#### Escaping HTML
Modules [`core.string.escape-html`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.string.escape-html.js) and [`core.string.unescape-html`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.string.unescape-html.js).
```javascript
String
  #escapeHTML() -> str
  #unescapeHTML() -> str
```
[Examples](http://goo.gl/6bOvsQ):
```javascript
'<script>doSomething();</script>'.escapeHTML(); // => '&lt;script&gt;doSomething();&lt;/script&gt;'
'&lt;script&gt;doSomething();&lt;/script&gt;'.unescapeHTML(); // => '<script>doSomething();</script>'
```
#### delay
Module [`core.delay`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.delay.js). [Promise](#ecmascript-6-promise)-returning delay function, [esdiscuss](https://esdiscuss.org/topic/promise-returning-delay-function). [Example](http://goo.gl/lbucba):
```javascript
delay(1e3).then(() => log('after 1 sec'));

(async () => {
  await delay(3e3);
  log('after 3 sec');
  
  while(await delay(3e3))log('each 3 sec');
})();
```
#### Console
Module [`core.log`](https://github.com/zloirock/core-js/blob/v1.2.6/modules/core.log.js). Console cap for old browsers and some additional functionality. In IE, Node.js / IO.js and Firebug `console` methods not require call from `console` object, but in Chromium and V8 this throws error. For some reason, we can't replace `console` methods by their bound versions. Add `log` object with bound console methods. Some more sugar: `log` is shortcut for `log.log`, we can disable output.
```javascript
log ==== log.log
  .{...console API}
  .enable() -> void
  .disable() -> void
```
```javascript
// Before:
if(window.console && console.warn)console.warn(42);
// After:
log.warn(42);

// Before:
setTimeout(console.warn.bind(console, 42), 1000);
[1, 2, 3].forEach(console.warn, console);
// After:
setTimeout(log.warn, 1000, 42);
[1, 2, 3].forEach(log.warn);

// log is shortcut for log.log
setImmediate(log, 42); // => 42

log.disable();
log.warn('Console is disabled, you will not see this message.');
log.enable();
log.warn('Console is enabled again.');
```

## Missing polyfills
- ES5 `JSON` is missing now only in IE7- and never it will be added to `core-js`, if you need it in these old browsers available many implementations, for example, [json3](https://github.com/bestiejs/json3).
- ES6 Typed Arrays can be polyfilled without serious problems, but it will be slow - getter / setter for each element and they are missing completely only in IE9-. You can use [this polyfill](https://github.com/inexorabletash/polyfill/blob/master/typedarray.js). *Possible*, it will be added to `core-js` in the future, completely or only missing methods of existing arrays. 
- ES6 `String#normalize` is not very usefull feature, but this polyfill will be very large. If you need it, you can use [unorm](https://github.com/walling/unorm/).
- ES6 `Proxy` can't be polyfilled, but for Node.js / Chromium with additional flags you can try [harmony-reflect](https://github.com/tvcutsem/harmony-reflect) for adapt old style `Proxy` API to final ES6 version.
- ES6 logic for `@@isConcatSpreadable` and `@@species` (in most places) can be polyfilled without problems, but it will cause serious slowdown in popular cases in some engines. It will be polyfilled when it will be implemented in modern engines.
- ES7 `Object.observe` can be polyfilled with many limitations, but it will be very slow - dirty checking on each tick. In nearest future it will not be added to `core-js` - it will cause serious slowdown in applications which uses `Object.observe` and fallback if it's missing. *Possible* it will be added as optional feature then most actual browsers will have this feature. Now you can use [this polyfill](https://github.com/MaxArt2501/object-observe).
- ES7 `SIMD`. `core-js` doesn't adds polyfill of this feature because of large size and some other reasons. You can use [this polyfill](https://github.com/tc39/ecmascript_simd/blob/master/src/ecmascript_simd.js).
- `window.fetch` is not crossplatform feature, in some environments it make no sense. For this reason I don't think it should be in `core-js`. Looking at the large number of requests it *maybe*  added in the future. Now you can use, for example, [this polyfill](https://github.com/github/fetch).