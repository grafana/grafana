/* */ 
"format cjs";
"use strict";

require("core-js/shim");

require('babel-runtime/regenerator/runtime');

if (global._babelPolyfill) {
  throw new Error("only one instance of babel/polyfill is allowed");
}
global._babelPolyfill = true;