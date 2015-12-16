# es6-shim x.x.x (not yet released)

# es6-shim 0.33.13 (12 Nov 2015
* [Fix] `Number`: when no arguments are passed, return `+0`.
* [Fix] `Number`: Make sure string values are trimmed before attempting to parse.
* [Tests] cleaning up `Number` tests)
* [Dev Deps] update `uglify-js`

# es6-shim 0.33.12 (11 Nov 2015)
* [Fix] IE 8: more NFE madness.
* [Dev Deps] update `es5-shim`
* [Docs] removing now-fixed `Number` caveat
* [Docs] use assertions so `evalmd` will test the readme better.
* [Docs] fix incorrect isFinite note (#373)

# es6-shim 0.33.11 (9 Nov 2015)
* [Fix] handle future change of RegExp.prototype not being a regex (#370, #371)
* [Fix] disallow invalid hex strings in `Number` (#369)
* [Tests] Tweak "polluted prototype" approach
* [Dev Deps] update `chai`, `es5-shim`, `eslint`, `@ljharb/eslint-config`, `jscs`

# es6-shim 0.33.10 (2 Nov 2015)
* [Fix] the `Number` constructor properly trims (or not) whitespace characters (#368)
* [Fix] `Number('0b12')` and `Number('0o18')` should both be `NaN` (#366)
* [Tests] Fix npm upgrades in older nodes
* [Tests] add `npm run tests-only`
* [Tests] on `node` `v5.0`
* [Tests] ensure `JSON.stringify` has the right name
* [Tests] add `npm run eslint`
* [Dev Deps] update `es5-shim`, `jscs`
* [Cleanup] Rearrange things so that they’re defined before they’re used
* [Cleanup] Don't reassign to function or catch parameters
* [Cleanup] Remove unused variables
* [Refactor] String#trim shim should use `defineProperty`, and check more non-whitespace chars

# es6-shim 0.33.9 (29 Oct 2015)
* [Fix] IE 8: `Number(new Number(1))` was throwing. More NFE madness. (#365)

# es6-shim 0.33.8 (23 Oct 2015)
* [Fix] IE 8: `Promise.resolve(2)` was throwing. More named function expression madness.
* [Tests] Reflect: Don't attempt to define properties on this test object unless we're in true ES5.

# es6-shim 0.33.7 (23 Oct 2015)
* [Fix] Ensure `preserveToString` does not throw when the original does not exist (#359)
* [Fix] `Promise`: properly handle named function expressions in IE 8.
* [Fix] `Number`: `wrapConstructor` now works in ES3 (#365)
* [Docs] Document `Number` supporting string binary and octal literals.
* [Tests] add commented-out test for `typeof Number.call(Object(3), 3) === 'number'`, which fails atm.
* [Tests] Fix browser tests sans-`npm install`
* [Dev Deps] update `es5-shim`, `jscs`, `uglify-js`, `chai`

# es6-shim 0.33.6 (29 Sep 2015)
* [Fix] In IE 6-8, of course, `typeof setTimeout` is "object"
* [Tests] Upgrade jQuery on the test HTML pages

# es6-shim 0.33.5 (28 Sep 2015)
* [Fix] IE 6-8 have wacky scoping issues with named function expressions.
* [Fix] Apparently in IE 8, RegExp#test is an own property of regexes, not a prototype method
* [Fix] Make sure to treat `es5-sham`'s `Object.defineProperty` as unsupported, in IE 8

# es6-shim 0.33.4 (27 Sep 2015)
* [Fix] Add test, and fix, for `JSON.stringify(Object(Symbol()))` throwing on Chrome 45
* [Fix] Wrap `JSON.stringify` when `Symbol` exists and it fails to serialize them correctly
* [Fix] fix `Reflect.defineProperty` on edge v0.12
* [Robustness] Cache `Array.isArray` internally
* [Refactor] Use internal `overrideNative` helper for String.prototype HTML methods
* [Refactor] Update `is-arguments` implementation; don't call down legacy code path in modern engines
* [Tests] Add `evalmd` to verify that example code blocks are valid
* [Tests] Adding a test for Safari 7.1 and later (runtime check added in 8a8ddd36186cdc1fcb3fcc259ec9ecef1e141901)
* [Tests] Add additional `JSON.stringify` test for `Symbol` and object `Symbol` values
* [Tests] up to `io.js` `v3.3`, `node` `v4.1`
* [Dev Deps] update `es5-shim`, `mocha`, `chai`

# es6-shim 0.33.3 (31 Aug 2015)
* [Fix] Handle Firefox Nightly's broken `construct` method
* [Tests] Add `JSON.stringify` tests for handling `Symbol`s

# es6-shim 0.33.2 (26 Aug 2015)
* [Fix] Make sure that minified code preserves function names.
* [Fix] Skip the `Promise` shim when `setTimeout` is not available ([#301](https://github.com/paulmillr/es6-shim/issues/301#issuecomment-126566703))
* [Docs] Add note about `setPrototypeOf` on null objects

# es6-shim 0.33.1 (20 Aug 2015)
* [New] Add support for binary and octal literals in strings to the `Number` constructor (#358)
* [Docs] Update spec link to final spec
* [Fix] `Reflect.enumerate`: does not necessarily wait until the first `next()` to determine keys.
* [Refactors] split up some tests; name some functions; remove unnecessary code
* {Refactors] make ObjectIterator properties non-enumerable
* [Refactors] Refactor `RegExp` wrapping code so most of it can be reused.
* [Tests] up to `io.js` `v3.1`
* [Dev Deps] update `grunt-contrib-connect`, `jscs`

# es6-shim 0.33.0 (30 Jul 2015)
* [Breaking] Avoid CSP errors in Chrome apps by using global var detection (#301)
* [Performance] Rearranging some of the Map/Set runtime shim clobberings to be more efficient.
* [Refactor] Implement `Array.of` directly, rather than in terms of `Array.from`
* [Dev Deps] Update `chai`, `es5-shim`, `promises-aplus-tests`, `uglify-js`
* [Tests] Add test for `Object.getPrototypeOf` accepting primitives.
* [Tests] Bail out of individual `Reflect` tests when the methods don’t exist
* [Tests] Test on latest `io.js`

# es6-shim 0.32.3 (21 Jun 2015)
* [Fix] Override or wrap native `Reflect` methods in Microsoft Edge v0.11 as required.
* [Fix] Edge v0.11: `Array.from([], undefined)` should not throw
* [Fix] Fix a bug in `Array.from handles iterables` runtime clobbering, which would always replace the native function
* [Fix] Ensure that `Set#has` has the correct name in Edge v0.11
* [Tests] Add `Map`/`Set` error messages for Edge v0.11
* [Tests] Fix `Math.fround` test value for Edge v0.11
* [Tests] Bail out of `Map`/`Set` test blocks if they don't exist
* [Docs] Update ES5 subclassing instructions in the README.
* [Dev Deps] Update `es5-shim`

# es6-shim 0.32.2 (17 Jun 2015)
* [Fix] `Object.assign` with no sources should coerce to an object (#348)
* [Fix] `String#includes` should throw when given a `RegExp` (#349)
* [Fix] `RegExp()` should not throw (#350)
* [Fix] Create `Value.defineByDescriptor`, fix `create` when `Object.create` is unavailable.
* [Compliance] Update `Promise.reject` to match official ECMA-262 spec.
* [Dev Deps] Update `es5-shim`

# es6-shim 0.32.1 (13 Jun 2015)
* [Fix] Make sure that all `Map`/`Set` shim forms properly add an iterable to the collection instance.
* [Tests] Make sure none of the `Array` ToLength tests throw *any* error (#347)

# es6-shim 0.32.0 (7 Jun 2015)
* [Spec compliance] Update Promises to match finalized ES6 spec (#345, #344, #239)
* [Fix] Ensure `Map`, `Set`, and `Promise` shims all throw when used without "new".
* [Tests] Fix the pending exceptions test for Safari 5.1
* [Refactor] Since the String HTML shims will be iterated anyways, no need to defineProperties them twice.
* [Deps] Update `chai`, `es5-shim`

# es6-shim 0.31.3 (2 Jun 2015)
* [Fix] Properly name more shim functions
* [Fix] Fix an IE bug where the layout engine internally calls the userland `Object.getOwnPropertyNames`
* [Fix] Ensure `Map.prototype[Symbol.iterator] === Map.prototype.entries`
* [Fix] Ensure `Set.prototype[Symbol.iterator] === Set.prototype.values`
* [Tests] `Object.assign` pending exceptions: IE 9 `preventExtensions` doesn't throw, even in strict mode
* [Security] Cache more native methods in case they're overwritten later
* [Tests] IE 11 has native `Map`/`Set`, but it takes an optional *function*, not an optional iterable, in the constructor
* [Tests] Add more "exists" early bailouts, to declutter native test results
* [Docs] Alphabetize shim lists in the README
* [Perf] Add more `Map`/`Set` fast paths for more primitives: boolean, null, undefined
* [Tests] Test up to `io.js` `v2.2`
* [Deps] Update `mocha`, `es5-shim`, `uglify-js`, `jshint`
* [Refactor] Style cleanups

# es6-shim 0.31.2 (9 May 2015)
* Fix ES5 `Array.prototype` method wrappers to return the correct value. (#341)

# es6-shim 0.31.1 (7 May 2015)
* `RegExp` should work properly as a wrapper (#340)

# es6-shim 0.31.0 (1 May 2015)
* All Array.prototype methods should use `ToLength`, not `ToUint32`, on `this.length`.
* Preserve and use original Array.prototype functions (for later shimming)
* Make String#{startsWith, endsWith, includes} tests a bit more granular.
* Fix Map/Set invalid receiver error messages for WebKit
* Update `grunt-saucelabs`, `jscs`

# es6-shim 0.30.0 (26 Apr 2015)
* `Map` and `Set` methods are not generic, and must only be called on valid `Map` and `Set` objects.
* Use the native `Number#clz` (in Safari 8, eg) inside `Math.clz32`

# es6-shim 0.29.0 (26 Apr 2015)
* Test on `io.js` `v1.7` and `v1.8`
* Ensure that shallowly wrapped Maps’ and Sets’ prototypes aren't one level too far away.
* Update `chai` and use new matchers
* Avoid reassigning argument variables to avoid deoptimizations
* Ensure that ES3 browsers get both `Object.is` and `Object.assign`
* Improve `Object.assign` to avoid leaking arguments in v8
* Ensuring `Number.parseInt === parseInt` (failed in FF 37)
* a little more accurate Math.cbrt (#335)
* Test cleanups
* Adding `Symbol.unscopables` tests
* Adding tests to ensure that default iterators on builtins === the appropriate prototype function.

# es6-shim 0.28.2 (13 Apr 2015)
* `Map` and `Set` should have an arity of 0.

# es6-shim 0.28.1 (12 Apr 2015)
* Ensure `Object.assign` only includes enumerable Symbols.

# es6-shim 0.28.0 (12 Apr 2015)
* Ensure `Object.assign` also includes Symbols.
* Make sure to clobber Firefox 37's very slow native Object.assign, that has "pending exception" logic.
* Adding much more granular Set/Map acceptance tests and replacements, to preserve as much of the original implementation as possible. (#326, #328)
* Lots of test additions and cleanup
 * Fill in (and fix) missing name, arity, and enumerability tests.
 * Using `property` matcher for a more helpful failure message.
 * Make sure this test doesn't fail if `Array#values` doesn't exist yet.
 * Make this `@@iterator` test not depend on `Array#values`, and properly skip tests if the symbol isn't available.
* Update `Math.fround` with a much smaller implementation (#332)
* Lock `uglify-js` down to v2.4.17, since v2.4.18 and v2.4.19 have a breaking change.
* Update `es5-shim`, `mocha`, `grunt-contrib-connect`, `chai`, `jshint`
* IE 11 TP has a broken `String.raw` implementation
* Overwriting some imprecise Math functions on IE 11 TP.
* Overwrite `Math.imul` in Safari 8 to report the correct length.
* Fix Math.round for very large numbers
* Don't rely on shims in tests, for better native failure checking.
* Shim `Object.is` in ES3 environments, and add tests.
* Test the native `Object.assign` prior to shimming it.
* Tweak the `travis-ci` config to make a separate "lint only" test run.
* Fix Firefox 4 test failures: ensure RegExp global aliases starting with "$" exist.
* more efficient Math.clz32 (#327)
* Fix Webkit nightly bugs with `Array.from` and `Array.of`.
* Make sure shims that depend on `Number.isNaN` and `Number.isFinite` will always work.
* The latest Webkit nightly has a bug with `String#includes` and a position arg of `Infinity`.
* Webkit r181855 has a noncompliant `String#startsWith` and `String#endsWith`
* Clean up README; add more accurate note about `es5-shim`.
* Updating the `String.raw` code to be more in line with the changes in RC2/Rev 35 of the spec.

# es6-shim 0.27.1 (5 Mar 2015)
* Revert `Array#slice` changes. (#322)
* Test on `io.js` `v1.4`

# es6-shim 0.27.0 (26 Feb 2015)
* Overwrite `Array#slice` so that it supports Array subclasses.
* Improve `Map`/`Set` `TypeError` messages when called as a function. (#321)

# es6-shim 0.26.1 (25 Feb 2015)
* Ensure `Array`/`Array.prototype` functions have the correct name.
* Chrome 40 defines the incorrect name for `Array#values`
* Make sure that `Array.of` works when subclassed.

# es6-shim 0.26.0 (24 Feb 2015)
* Ensure that remaining Object static methods accept primitives.
* Update `chai`
* Document `String.prototype` HTML methods and `Reflect` methods in README

# es6-shim 0.25.3 (22 Feb 2015)
* Removing nonexistent arguments from some String.prototype HTML methods
* All grade A-supported `node`/`iojs` versions now ship with an `npm` that understands `^`.
* Test on `iojs-v1.3`
* Update `chai`
* Add a LICENSE file

# es6-shim 0.25.2 (18 Feb 2015)
* If someone (looking at you, chalk) has previously modified String.prototype with a non-function “bold”, don‘t break. (#315)

# es6-shim 0.25.1 (18 Feb 2015)
* Add Annex B String.prototype HTML methods.
* Overwriting Annex B String.prototype HTML methods in IE 9, which both uppercases the tag names, and fails to escape double quotes.
* Overwriting Annex B String.prototype HTML methods in Safari 4-5, which fails to escape double quotes.
* Ensuring that Date#toString returns “Invalid Date” when the date‘s value is NaN.
* Test on `iojs-v1.2`

# es6-shim 0.25.0 (16 Feb 2015)
* Ensure Object.getOwnPropertyNames accepts primitives.
* Make sure the replaced `Object.keys` is non-enumerable.
* Clean up lots of tests to make failures easier to read, and false negatives less common

# es6-shim 0.24.0 (5 Feb 2015)
* Improving accuracy of Math.expm1 values, and ensuring a shim on Linux FF 35, which reports an inaccurate value for Math.expm1(10).
* Fix bug from 7454db144e5aa251d599415cfb296b67aa3cf992 which prevented String#startsWith and String#endsWith from being overwritten in old Firefox.
* Improve tests across a wider list of browsers
* Ensure that individual Reflect methods are added when possible
* Add Reflect (#313)
* Fix node 0.11: it has an imprecise Math.sinh with very small numbers.
* Alter String#repeat RangeError message to align with Firefox’s native implementation.

# es6-shim 0.23.0 (26 Jan 2015)
* Use Symbol.species when available, else fall back to "@@species" (renamed from "@@create")
* Fix `npm run test-native`
* Correct broken Math implementations: `log1p`, `exmp1`, `tanh`, `acosh`, `cosh`, `sinh`, `round` (#314)
* Update `jscs`, `grunt-saucelabs`, `jshint`

# es6-shim 0.22.2 (4 Jan 2015)
* Faster travis-ci builds
* Better ES3 support: quoting/avoiding reserved words
* Update `mocha`, `jscs`, `jshint`, `grunt-saucelabs`, `uglify-js`

# es6-shim 0.22.1 (13 Dec 2014)
* Make RegExp#flags generic, per spec (#310)

# es6-shim 0.22.0 (12 Dec 2014)
* Add RegExp#flags
* Make `new RegExp` work with both a regex and a flags string
* Remove non-spec `Object.{getPropertyNames,getPropertyDescriptor}`

# es6-shim 0.21.1 (4 Dec 2014)
* Promise/Promise.prototype methods, and String#{startsWith,endsWith} are now not enumerable
* Array#{keys, values, entries} should all be @@unscopeable in browsers that support that
* Ensure that tampering with Function#{call,apply} won’t break internal methods
* Add Math.clz32, RegExp tests
* Update es6-sham UMD
* Update `chai`, `es5-shim`, `grunt-saucelabs`, `jscs`

# es6-shim 0.21.0 (21 Nov 2014)
* String#contains → String#includes per 2014-11-19 TC39 meeting
* Use an invalid identifier as the es6-shim iterator key, so it doesn’t show up in the console as easily.

# es6-shim 0.20.4 (20 Nov 2014)
* Performance improvements: avoid slicing arguments, avoid `Function#call` when possible
* Name `String.{fromCodePoint,raw}` for debugging
* Fix `String.raw` to match spec
* Ensure Chrome’s excess Promise methods are purged
* Ensure `Set#keys === Set#values`, per spec

# es6-shim 0.20.3 (19 Nov 2014)
* Fix Set#add and Map#set to always return "this" (#302)
* Clarify TypeError messages thrown by Map/Set
* Fix Chrome 38 bug with Array#values

# es6-shim 0.20.2 (28 Oct 2014)
* Fix AMD (#299)

# es6-shim 0.20.1 (27 Oct 2014)
* Set#delete and Map#delete should return false unless a deletion occurred. (#298)

# es6-shim 0.20.0 (26 Oct 2014)
* Use a more reliable UMD
* export the global object rather than undefined

# es6-shim 0.19.2 (25 Oct 2014)
* Set#delete and Map#delete should return a boolean indicating success. (#298)
* Make style consistent; add jscs

# es6-shim 0.19.1 (14 Oct 2014)
* Fix Map#set and Set#add to be chainable (#295)
* Update mocha

# es6-shim 0.19.0 (9 Oct 2014)
* Detect and override noncompliant Map in Firefox 32 (#294)
* Fix Map and Set for engines that don’t preserve numeric key order (#292, #290)
* Detect and override noncompliant Safari 7.1 Promises (#289)
* Fix Array#keys and Array#entries in Safari 7.1
* General style and whitespace cleanup
* Update dependencies
* Clean up tests for ES3 by removing reserved words

# es6-shim 0.18.0 (6 Sep 2014)
* Speed up String#trim replacement (#284)
* named Array#find and Array#findIndex for easier debugging
* Replace broken native implementation in Firefox 25-31 for Array#find and Array#findIndex
* Ensure String.fromCodePoint has the correct length in Firefox
* List the license in `package.json` for `npm`
* Array.from: fix spec bug with Array.from([], undefined) throwing
* Array.from: fix Firefox Array.from bug wrt swallowing negative lengths vs throwing

# es6-shim 0.17.0 (31 Aug 2014)
* Added es6-sham (#281)
* Fixing some flaky tests (#268)
* Tweaking how ArrayIterator is checked in its "next" function
* Cleaning up some of the logic in Array.from

# es6-shim 0.16.0 (6 Aug 2014)
* Array#find and Array#findIndex: no longer skips holes in sparse arrays, per https://bugs.ecmascript.org/show_bug.cgi?id=3107

# es6-shim 0.15.1 (5 Aug 2014)
* Array.from: now correctly throws if provided `undefined` as a mapper function
* Array.from: now correctly works if provided a falsy `thisArg`
* Fix tests so they work properly when Array#(values|keys|entries) are not present
* Add `npm run lint` to run style checks independently
* Add `test/native.html` so browsers can be easily checked for shim-less compliance.

# es6-shim 0.15.0 (31 Jul 2014)
* Object.assign no longer throws on null or undefined sources, per https://bugs.ecmascript.org/show_bug.cgi?id=3096

# es6-shim 0.14.0 (20 Jul 2014)
* Properly recognize Symbol.iterator when it is present (#277)
* Fix Math.clz’s improper handling of values that coerce to NaN (#269)
* Fix incorrect handling of negative end index on Array#fill (#270)
* Removed Object.getOwnPropertyKeys, which shouldn’t be anywhere (#267)
* Fixed arity of Map and Set constructors, per 2014.04.27 draft spec (rev 24)
* Added a full additional suite of ES6 promise tests (thanks to @smikes!) (#265)
* Make Number.isInteger a bit more efficient (#266)
* Added `npm run test-native` to expose how broken implementations are without the shim ;-)
* Added additional tests

# es6-shim 0.13.0 (11 Jun 2014)
* Adapt to new Array.from changes: mapper function is now called with both value and index (#261, #262)
* More reliably getting the global object in strict mode to fix node-webkit (#258, #259)
* Properly test the global Promise for ignoring non-function callbacks (#258)

# es6-shim 0.12.0 (4 Jun 2014)
* Fix String#trim implementations that incorrectly trim \u0085
* Stop relying on ArrayIterator being a public var, fixing Safari 8

# es6-shim 0.11.1 (2 Jun 2014)
* Make sure to shim Object.assign in all environments, not just true ES5
* Now including minified file and source map

# es6-shim 0.11.0 (11 May 2014)
* Remove `Object.getOwnPropertyDescriptors`, per spec. (#234, #235)
* IE8 fixes. (#163, #236)
* Improve `Promise` scheduling. (#231)
* Add some more standalone shims
* Use an Object.create fallback, for better ES3 compatibility
* Fix Math.expm1 in more browsers (#84)
* Fix es6-shim in Web Workers (#247, #248)
* Correct Object.assign to take multiple sources (#241)

# es6-shim 0.10.1 (13 Mar 2014)
* Update bower.json, component.json, and .npmignore (#229, #230, #233)
* Minor updates to `Promise` implementation and test suite.
* Workaround lack of "strict mode" in IE9. (#232)

# es6-shim 0.10.0 (1 March 2014)
* Implement `Promise`, per spec. (#209, #215, #224, #225)
* Make `Map`/`Set` subclassable; support `iterable` argument to
  constructor (#218)
* Rename `Number#clz` to `Math.clz32` (#217)
* Bug fixes to `Array#find` and `Array#findIndex` on sparse arrays (#213)
* Re-add `Number.isInteger` (mistakenly removed in 0.9.0)
* Allow use of `arguments` as an iterable
* Minor spec-compliance fixes for `String.raw`
* In ES6, `Object.keys` accepts non-Object types (#220)
* Improved browser compatibility with IE 9/10, Opera 12 (#225)

# es6-shim 0.9.3 (5 February 2014)
* Per spec, removed `Object.mixin` (#192)
* Per spec, treat -0 and +0 keys as identical in Map/Set (#129, #204)
* Per spec, `ArrayIterator`/`Array#values()` skips sparse indexes now. (#189)
* Added `Array.from`, supporting Map/Set/Array/String iterators (the String iterator iterates over codepoints, not indexes) (#182)
* Bug fixes to Map/Set iteration after concurrent delete. (#183)
* Bug fixes to `Number.clz`: 0 and 0x100000000 are handled correctly now. (#196)
* Added `Math.fround` to truncate to a 32-bit floating point number. (#140)
* Bug fix for `Math.cosh` (#178)
* Work around Firefox bugs in `String#startsWith` and `String#endsWith` (#172)
* Work around Safari bug in `Math.imul`

# es6-shim 0.9.2 (18 December 2013)
* Negative `String#endsWith` position is now handled properly.
* `TypeError` is now thrown when string methods are called
  on `null` / `undefined`.

# es6-shim 0.9.1 (28 October 2013)
* Added `Array#copyWithin` and `Number.MIN_SAFE_INTEGER`
* Big speed-up of Maps / Sets for string / number keys:
  they are O(1) now.
* Changed `Math.hypot` according to spec.
* Other small fixes.

# es6-shim 0.9.0 (30 August 2013)
* Added Array iteration methods: `Array#keys`, `Array#values`, `Array#entries`, which return an `ArrayIterator`
* Changed `Map` and `Set` constructors to conform to spec when called without `new`
* Added `Math.imul`
* Per spec, removed `Number.toInteger`, `Number.isInteger`, and `Number.MAX_INTEGER`; added `Number.isSafeInteger`, `Number.MAX_SAFE_INTEGER`
* Added extensive additional tests for many methods

# es6-shim 0.8.0 (8 June 2013)
* Added `Object.setPrototypeOf`, `Set#keys`, `Set#values`, `Map#keys`, `Map#values`, `Map#entries`, `Set#entries`.
* Fixed `String#repeat` according to spec.

# es6-shim 0.7.0 (2 April 2013)
* Added `Array#find`, `Array#findIndex`, `Object.assign`, `Object.mixin`,
  `Math.cbrt`, `String.fromCodePoint`, `String#codePointAt`.
* Removed `Object.isnt`.
* Made Math functions fully conform spec.

# es6-shim 0.6.0 (15 January 2013)
* Added `Map#keys`, `Map#values`, `Map#size`, `Set#size`, `Set#clear`.

# es6-shim 0.5.3 (2 September 2012)
* Made `String#startsWith`, `String#endsWith` fully conform spec.

# es6-shim 0.5.2 (17 June 2012)
* Removed `String#toArray` and `Object.isObject` as per spec updates.

# es6-shim 0.5.1 (14 June 2012)
* Made Map and Set follow Spidermonkey implementation instead of V8.
`var m = Map(); m.set('key', void 0); m.has('key');` now gives true.

# es6-shim 0.5.0 (13 June 2012)
* Added Number.MAX_INTEGER, Number.EPSILON, Number.parseInt,
Number.parseFloat, Number.prototype.clz, Object.isObject.

# es6-shim 0.4.1 (11 May 2012)
* Fixed boundary checking in Number.isInteger.

# es6-shim 0.4.0 (8 February 2012)
* Added Math.log10, Math.log2, Math.log1p, Math.expm1, Math.cosh,
Math.sinh, Math.tanh, Math.acosh, Math.asinh, Math.atanh, Math.hypot,
Math.trunc.

# es6-shim 0.3.1 (30 January 2012)
* Added IE8 support.

# es6-shim 0.3.0 (27 January 2012)
* Added Number.isFinite() and Object.isnt().

# es6-shim 0.2.1 (7 January 2012)
* Fixed a bug in String#endsWith().

# es6-shim 0.2.0 (25 December 2011)
* Added browser support.
* Added tests.
* Added Math.sign().

# es6-shim 0.1.0 (25 December 2011)
* Initial release
