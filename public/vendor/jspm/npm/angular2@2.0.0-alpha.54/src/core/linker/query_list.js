/* */ 
'use strict';
var collection_1 = require('../../facade/collection');
var lang_1 = require('../../facade/lang');
var async_1 = require('../../facade/async');
var QueryList = (function() {
  function QueryList() {
    this._results = [];
    this._emitter = new async_1.EventEmitter();
  }
  Object.defineProperty(QueryList.prototype, "changes", {
    get: function() {
      return this._emitter;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(QueryList.prototype, "length", {
    get: function() {
      return this._results.length;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(QueryList.prototype, "first", {
    get: function() {
      return collection_1.ListWrapper.first(this._results);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(QueryList.prototype, "last", {
    get: function() {
      return collection_1.ListWrapper.last(this._results);
    },
    enumerable: true,
    configurable: true
  });
  QueryList.prototype.map = function(fn) {
    return this._results.map(fn);
  };
  QueryList.prototype.filter = function(fn) {
    return this._results.filter(fn);
  };
  QueryList.prototype.reduce = function(fn, init) {
    return this._results.reduce(fn, init);
  };
  QueryList.prototype.toArray = function() {
    return collection_1.ListWrapper.clone(this._results);
  };
  QueryList.prototype[lang_1.getSymbolIterator()] = function() {
    return this._results[lang_1.getSymbolIterator()]();
  };
  QueryList.prototype.toString = function() {
    return this._results.toString();
  };
  QueryList.prototype.reset = function(res) {
    this._results = res;
  };
  QueryList.prototype.notifyOnChanges = function() {
    this._emitter.emit(this);
  };
  return QueryList;
})();
exports.QueryList = QueryList;
