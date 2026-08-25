// Prepended to the webpack entry only. The rspack build omits it, to find out whether
// anything still needs these.
//
// symbol-observable is the one with a known job: it defines Symbol.observable before any
// rxjs or redux copy evaluates, so plugins bundling their own rxjs agree with core.
import 'symbol-observable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';
import 'file-saver';
