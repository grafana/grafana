/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var collection_1 = require('../facade/collection');
function paramParser(rawParams) {
  if (rawParams === void 0) {
    rawParams = '';
  }
  var map = new collection_1.Map();
  if (rawParams.length > 0) {
    var params = rawParams.split('&');
    params.forEach(function(param) {
      var split = param.split('=');
      var key = split[0];
      var val = split[1];
      var list = lang_1.isPresent(map.get(key)) ? map.get(key) : [];
      list.push(val);
      map.set(key, list);
    });
  }
  return map;
}
var URLSearchParams = (function() {
  function URLSearchParams(rawParams) {
    if (rawParams === void 0) {
      rawParams = '';
    }
    this.rawParams = rawParams;
    this.paramsMap = paramParser(rawParams);
  }
  URLSearchParams.prototype.clone = function() {
    var clone = new URLSearchParams();
    clone.appendAll(this);
    return clone;
  };
  URLSearchParams.prototype.has = function(param) {
    return this.paramsMap.has(param);
  };
  URLSearchParams.prototype.get = function(param) {
    var storedParam = this.paramsMap.get(param);
    if (collection_1.isListLikeIterable(storedParam)) {
      return collection_1.ListWrapper.first(storedParam);
    } else {
      return null;
    }
  };
  URLSearchParams.prototype.getAll = function(param) {
    var mapParam = this.paramsMap.get(param);
    return lang_1.isPresent(mapParam) ? mapParam : [];
  };
  URLSearchParams.prototype.set = function(param, val) {
    var mapParam = this.paramsMap.get(param);
    var list = lang_1.isPresent(mapParam) ? mapParam : [];
    collection_1.ListWrapper.clear(list);
    list.push(val);
    this.paramsMap.set(param, list);
  };
  URLSearchParams.prototype.setAll = function(searchParams) {
    var _this = this;
    searchParams.paramsMap.forEach(function(value, param) {
      var mapParam = _this.paramsMap.get(param);
      var list = lang_1.isPresent(mapParam) ? mapParam : [];
      collection_1.ListWrapper.clear(list);
      list.push(value[0]);
      _this.paramsMap.set(param, list);
    });
  };
  URLSearchParams.prototype.append = function(param, val) {
    var mapParam = this.paramsMap.get(param);
    var list = lang_1.isPresent(mapParam) ? mapParam : [];
    list.push(val);
    this.paramsMap.set(param, list);
  };
  URLSearchParams.prototype.appendAll = function(searchParams) {
    var _this = this;
    searchParams.paramsMap.forEach(function(value, param) {
      var mapParam = _this.paramsMap.get(param);
      var list = lang_1.isPresent(mapParam) ? mapParam : [];
      for (var i = 0; i < value.length; ++i) {
        list.push(value[i]);
      }
      _this.paramsMap.set(param, list);
    });
  };
  URLSearchParams.prototype.replaceAll = function(searchParams) {
    var _this = this;
    searchParams.paramsMap.forEach(function(value, param) {
      var mapParam = _this.paramsMap.get(param);
      var list = lang_1.isPresent(mapParam) ? mapParam : [];
      collection_1.ListWrapper.clear(list);
      for (var i = 0; i < value.length; ++i) {
        list.push(value[i]);
      }
      _this.paramsMap.set(param, list);
    });
  };
  URLSearchParams.prototype.toString = function() {
    var paramsList = [];
    this.paramsMap.forEach(function(values, k) {
      values.forEach(function(v) {
        return paramsList.push(k + '=' + v);
      });
    });
    return paramsList.join('&');
  };
  URLSearchParams.prototype.delete = function(param) {
    this.paramsMap.delete(param);
  };
  return URLSearchParams;
})();
exports.URLSearchParams = URLSearchParams;
