// Prepended to the webpack entry only. The rspack build omits it, to find out whether
// anything still needs these.
//
// symbol-observable defines Symbol.observable eagerly. rxjs and redux each read
// `Symbol.observable || '@@observable'` once, at module-eval time, so every copy on the
// page has to land on the same answer. Importing it first fixes that answer before core
// resolves it, so a bundle that polyfills the symbol later can't diverge from core.
import 'symbol-observable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';
import 'file-saver';
