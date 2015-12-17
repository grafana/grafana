2014-10-31, Version 0.3.4
=========================

 * Sync CHANGES.md (Ryan Graham)


2014-10-24, Version 0.3.3
=========================

 * Version 0.3.3 (Bert Belder)

 * require: improve require('module') hook (Bert Belder)


2014-10-24, Version 0.3.2
=========================

 * Version 0.3.2 (Bert Belder)

 * test: verify that require('module') works (Bert Belder)

 * require: make require('module') not throw (Bert Belder)

 * native_module: provide script name on node v0.10 (Bert Belder)


2014-10-22, Version 0.3.1
=========================

 * Version 0.3.1 (Bert Belder)

 * events: fix bug in EventEmitter#listeners() (Bert Belder)

 * Remove stale file (Bert Belder)


2014-10-13, Version 0.3.0
=========================

 * Version 0.3.0 (Bert Belder)

 * doc: now supports node v0.10 (Bert Belder)

 * test: assert zone equality with === instead of strictEqual() (Bert Belder)

 * stream-wrap: don't attempt to close closing handles when signaled (Bert Belder)

 * stream: release the callback if .write()/.end() throws (Bert Belder)

 * stream: always enter the stream owner zone (Bert Belder)

 * stream-wrap: make it possible to clean up orphaned streams (Bert Belder)

 * test: add anoter x-zone ee test (Bert Belder)

 * cares-wrap: fix typo (Bert Belder)

 * http wrapper: support node v0.10 (Bert Belder)

 * test: add 3 more dns tests (Bert Belder)

 * cares-wrap: fix plenty of bugs, add node 0.10 support (Bert Belder)

 * process: recreate the process object instead of monkey patching (Bert Belder)

 * binding.js: style (Bert Belder)

 * node-lib: transform source code instead of monkey patching (Bert Belder)

 * zone-callback: assert that the callback is a function (Bert Belder)

 * stream-wrap: don't close stdio pipes opened with PipeWrap.open (Bert Belder)

 * Test: move away from nodeunit (Bert Belder)

 * test: don't use strictEqual to compare zones (Bert Belder)

 * Fix a couple of typos (Bert Belder)

 * Make the EventEmitter monkey patch work in node 0.10 (Bert Belder)

 * EventEmitter: use typeof instead of util.isFunction() (Bert Belder)

 * Require: monkey-patch events before streams (Bert Belder)

 * Test: don't test cork/uncork in node v0.10 (Bert Belder)

 * Support process._rawDebug() in node v0.10 (Bert Belder)

 * Lint (Bert Belder)

 * process: monkey-patch process.std* correctly (Bert Belder)

 * stream: fix duplex/writable mixup (Bert Belder)

 * require: split up v0.10 and v0.12 require() hooks (Bert Belder)

 * Add node v0.10 detection helper (Bert Belder)

 * Fix long stack formatting for node v0.10 (Bert Belder)

 * Make NativeModule work with node v0.10 (Bert Belder)

 * stream-wrap: add node 0.10 support (Bert Belder)

 * Don't unregister ProcessWrap from zone when signaled (Bert Belder)

 * Revert "coverage: Add test coverage" (Bert Belder)

 * src: Rename more to be non-case-sensitive compat. (Krishna Raman)

 * lint: Fix lint errors (Krishna Raman)

 * coverage: Add test coverage (Krishna Raman)

 * test: rename test to be non-case-sensitive FS compatible (Krishna Raman)

 * Make the test runner work on windows and linux (Bert Belder)

 * stream-wrap: re-implement with correct refcounting semantics (Bert Belder)

 * Make jshint happy (Bert Belder)

 * test: add test for write callbacks (Bert Belder)

 * Zone: improve error message on assertion failure (Bert Belder)

 * debug server: unref only the server handle, not the stream (Bert Belder)

 * Update contribution guidelines (Ryan Graham)

 * Add v0.11+ requirement note to README (Krishna Raman)


2014-08-06, Version 0.2.1
=========================

 * Remove strong-docs requirement (Krishna Raman)


2014-07-31, Version 0.2.0
=========================

 * Make long stack traces the default (Krishna Raman)

 * Fix TTY, Socket and related callback cleanup (Krishna Raman)

 * Bugfix and add test cases for zone cleanup (Krishna Raman)

 * Fix typo in readme Fix #15 (Michael Mior)

 * Reimplement Zones to improve performace and API (Krishna Raman)

 * Now working on version 0.1.1 (Bert Belder)


2014-05-28, Version 0.1.0
=========================

 * Version 0.1.0 (Bert Belder)

 * readme: bring up-to-date (Bert Belder)

 * long-stack-http showcase: add README (Bert Belder)

 * Zone: prefer function._zoneName over function.name when naming a zone (Bert Belder)

 * long-stack showcase: spice up (Bert Belder)

 * showcase: add global readme (Bert Belder)

 * Zone: add zone.define (Bert Belder)

 * readme: use require('zone').enable() (Bert Belder)

 * long-stack showcase: add readme (Bert Belder)

 * setup: print message about using zone (Bert Belder)

 * doc: use `zone.create` instead of `new Zone` (Bert Belder)

 * doc: remove mentions of the curried constructor (Bert Belder)

 * use zone.create everywhere (Bert Belder)

 * Zone: `zone.create()` is the new black (Bert Belder)

 * Zone: drop the curried constructor (Bert Belder)

 * setup: export only an enable() function (Bert Belder)

 * zone: relax type checks for zone children (Bert Belder)

 * Change to CPAL license (Issac Roth)

 * inspect showcase: add readme (Bert Belder)

 * Add link to internals.md (Rand McKinney)

 * Moved some info to internals.md (Rand McKinney)

 * Create internals.md (Rand McKinney)

 * showcase: add curl showcase (Bert Belder)

 * showcase: add example that combines long stack traces with http handling (Bert Belder)

 * error: remove excess newline from zone stack (Bert Belder)

 * node-lib: patch the http Agent (Bert Belder)

 * scheduler: set the active zone to `null` after leaving the scheduler (Bert Belder)

 * require: add '.js' extension to monkey-patched node-lib modules (Bert Belder)

 * stream-wrap: monkey-patch shutdown() (Bert Belder)

 * test: add file descriptor cleanup test (Bert Belder)

 * test: add temp dir (Bert Belder)

 * process-wrap: fix assignment to the wrong cache key (Bert Belder)

 * test: rename stream_write.js to stream-write.js (Bert Belder)

 * Now working on version 0.0.8 (Bert Belder)


2014-05-03, Version 0.0.7
=========================

 * Version 0.0.7 (Bert Belder)

 * stream-wrap: fix issue with platforms that support TryWrite (Bert Belder)

 * doc: child processes are now supported (Bert Belder)

 * doc: s/pseudoBytes/pseudoRandomBytes/ (Bert Belder)

 * test: add test for child_process zone support (Bert Belder)

 * bindings: monkey-patch process_wrap (Bert Belder)

 * stream-wrap: fix cleanup for read-only streams (Bert Belder)

 * stream-wrap: make inspect output friendlier (Bert Belder)

 * stream-wrap: register un-closable streams to the top of the zone (Bert Belder)

 * stream-wrap: track fd when streams are opened with a file descriptor (Bert Belder)

 * zone: add possibility to register children at the top of the child list (Bert Belder)

 * lib: drop debuglog usage and remove the debuglog module (Bert Belder)

 * zone: remove commented-out code (Bert Belder)

 * Move generator/yield section to wiki and link (Rand McKinney)

 * Fix TOC (Rand McKinney)

 * Rewrite overview and add initial rel. notes (Rand McKinney)

 * test: add EventEmitter unhandled error handling test (Bert Belder)

 * test: add Stream#write() zone tracking test (Bert Belder)

 * stream: call the write() and end() callbacks in the right zone (Bert Belder)

 * long-stack showcase: make the code a little more interesting (Bert Belder)

 * events: use zone.trow() to throw UncaughtException errors (Bert Belder)

 * Zone: use separate state variable 'exiting' for exiting zones w/o result (Bert Belder)

 * error: make the Error.zone property non-enumerable (Bert Belder)

 * Timer: clear (interval) timers when the zone has an error (Bert Belder)

 * Readme: correct the documentation for net.Socket cleanup behavior (Bert Belder)

 * Zone: re-signal a child when a zone throws (Bert Belder)

 * long-stack showcase: add node-style stack example (Bert Belder)

 * inspect showcase: add 'inspect.js' that delegates to the actual tool (Bert Belder)

 * inspect showcase: display instructions (Bert Belder)

 * inspect showcase: lint (Bert Belder)

 * showcase: remove the old demo (Bert Belder)

 * showcase: add long stack trace showcase (Bert Belder)

 * showcase: add inspect showcase (Bert Belder)

 * stream-wrap: display handle type names a little more friendly (Bert Belder)

 * Zone: use Error.zoneStack to display the zone stack (Bert Belder)

 * error: add hidden .zoneStack property to Error objects (Bert Belder)

 * inspect: display a message if there are no processes to inspect (Bert Belder)

 * inspect: rename dumpNext() to inspectNext() (Bert Belder)

 * dump: rename to 'inspect', move to 'bin' directory (Bert Belder)

 * Now working on version 0.0.7 (Bert Belder)


2014-05-01, Version 0.0.6
=========================

 * Version 0.0.6 (Bert Belder)

 * Add link to API doc. (Rand McKinney)

 * Fix heading error (Rand McKinney)

 * Reformat TOC (Rand McKinney)

 * Create api-doc.md (Rand McKinney)

 * Edited for npmjs and removed API doc. (Rand McKinney)

 * Now working on version 0.0.6 (Bert Belder)


2014-05-01, Version 0.0.5
=========================

 * Version 0.0.5 (Bert Belder)

 * Remove HTML comments generated by DocToc. (Rand McKinney)

 * Now working on version 0.0.5 (Bert Belder)


2014-04-30, Version 0.0.4
=========================

 * Version 0.0.4 (Bert Belder)

 * Test: add tests for zone completion callbacks (Bert Belder)

 * package.json: remove the tap dependency (Bert Belder)

 * Test: move the old tests to test/old (Bert Belder)

 * Test: make 'npm test' run the new test runner (Bert Belder)

 * Test: add tests to test the test runner (Bert Belder)

 * Test: add a very simple test harness (Bert Belder)

 * Zone: better error presence detection for Zone#complete (Bert Belder)

 * Zone: make setCallback/then/catch chainable (Bert Belder)

 * Zone: implement .then() and .catch() (Bert Belder)

 * Zone: remove superfluous assignment in setCallback() (Bert Belder)

 * Zone: don't load the zone library twice (Bert Belder)

 * lint (Bert Belder)

 * Zone: display long stack traces (Bert Belder)

 * Zone: capture the stack at construction time (Bert Belder)

 * Zone: wrap caught non-errors in NonError error objects (Bert Belder)

 * Implement NonError class to wrap non-error thrown values (Bert Belder)

 * tests: make tap work on windows (Bert Belder)

 * require: remove the patch() function (Bert Belder)

 * require: extract monkey patching into a separate function (Bert Belder)

 * Initial reorganization and editing (Rand McKinney)

 * require: always load modules into the root zone (Bert Belder)

 * Wrap fs methods at the binding layer (Bert Belder)

 * fs: wrap fs.read (Bert Belder)

 * fs: fix various issues with the wrapper (Bert Belder)

 * Update license and contribution guidelines after review (Bert Belder)

 * stream-wrap: don't auto-stop listening unless an error happened (Bert Belder)

 * stream-wrap: don't auto-stop reading unless an error happened (Bert Belder)

 * require: don't load the `buffer` module twice (Bert Belder)

 * Gate: fix typo in `call` and `callAsync` implementation (Bert Belder)

 * CONTRIBUTING: remove draft warning (Bert Belder)

 * CONTRIBUTING: add thank you note to the introduction (Bert Belder)

 * CONTRIBUTING: add lawyer-aproved CLA (Bert Belder)

 * CONTRIBUTING: change the patch signing instruction to be more formal (Bert Belder)

 * CONTRIBUTING: lint (Bert Belder)

 * Zone: don't immediately print stack trace when handling an error (Bert Belder)

 * Debug server: run in it's own zone (Bert Belder)

 * Setup: fix inaccurate comment (Bert Belder)

 * Zone: don't forcefully exit when an error happens in the root zone (Bert Belder)

 * Gate: also register to the zone if it's just a self-reference (Bert Belder)

 * stream-wrap: stop accepting connections when signaled (Bert Belder)

 * stream-wrap: close handle when signaled (Bert Belder)

 * stream-wrap: stop reading when signaled (Bert Belder)

 * stream-wrap: don't use inner function callback in .close() implementation (Bert Belder)

 * stream-wrap: immediately close gate if async operation fails sycnhronously (Bert Belder)

 * EventEmitter: close cross-zone listener gate when signaled (Bert Belder)

 * EventEmitter: properly close cross-zone listener gates (Bert Belder)

 * EventEmitter: name cross-zone listener gate better (Bert Belder)

 * Zone: run signal methods in parent zone (Bert Belder)

 * Zone: fix child not properly signaled bug (Bert Belder)

 * Gate: remove dummy .signal implementaion (Bert Belder)

 * events: better patching for zone-awareness (Bert Belder)

 * events.js: revert to node's implementation at 77d1f4a (Bert Belder)

 * Use new scheduler, redo zone/gate invocation methods (Bert Belder)

 * readme: tweak zone/gate invocation method API docs (Bert Belder)

 * Implement global scheduler (Bert Belder)

 * Add LinkedList utility class (Bert Belder)

 * lint fixes (Bert Belder)

 * EventEmitter: don't throw when removing a nonexisting listener (Bert Belder)

 * Zone: use linked list for keeping track of children (Bert Belder)

 * Now working on version 0.0.4 (Bert Belder)


2014-04-09, Version 0.0.3
=========================

 * Version 0.0.3 (Bert Belder)

 * stream_wrap: include TCP local and remote address in dump output (Bert Belder)

 * Make the demo a little more interesting (Bert Belder)

 * readme: add try...catch vs zone section (Bert Belder)

 * Add draft readme (Bert Belder)

 * Implement the magic zone.data property (Bert Belder)

 * Gate: provide a default, empty signal() implementation (Bert Belder)

 * Don't use 'null' zone for callbacks originating from the binding layer (Bert Belder)

 * dump tool: improve formatting (Bert Belder)

 * cares-wrap: remove unused variable (Bert Belder)

 * Zone: remove some stray debugging code (Bert Belder)

 * Now working on version 0.0.3 (Bert Belder)


2014-04-01, Version 0.0.2
=========================

 * Version 0.0.2 (Bert Belder)

 * Add draft CONTRIBUTING.md (Bert Belder)

 * Zone-wrap the dns/cares binding layer (Bert Belder)

 * Name stream requests (Bert Belder)

 * Now working on version 0.0.2 (Bert Belder)

 * Version 0.0.1 (Bert Belder)


2014-03-25, Version 0.0.1
=========================

 * First release!
