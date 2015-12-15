/* */ 
"format cjs";
/*global self*/
import Promise from './promise';

export default function polyfill() {
  var local;

  if (typeof global !== 'undefined') {
      local = global;
  } else if (typeof self !== 'undefined') {
      local = self;
  } else {
      try {
          local = Function('return this')();
      } catch (e) {
          throw new Error('polyfill failed because global object is unavailable in this environment');
      }
  }

  var P = local.Promise;

  if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
    return;
  }

  local.Promise = Promise;
}
