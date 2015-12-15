/* */ 
"format cjs";
import Promise from './es6-promise/promise';
import polyfill from './es6-promise/polyfill';

var ES6Promise = {
  'Promise': Promise,
  'polyfill': polyfill
};

/* global define:true module:true window: true */
if (typeof define === 'function' && define['amd']) {
  define(function() { return ES6Promise; });
} else if (typeof module !== 'undefined' && module['exports']) {
  module['exports'] = ES6Promise;
} else if (typeof this !== 'undefined') {
  this['ES6Promise'] = ES6Promise;
}

polyfill();
