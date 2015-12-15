/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var exceptions_1 = require('../facade/exceptions');
var collection_1 = require('../facade/collection');
var url_parser_1 = require('./url_parser');
var TouchMap = (function() {
  function TouchMap(map) {
    var _this = this;
    this.map = {};
    this.keys = {};
    if (lang_1.isPresent(map)) {
      collection_1.StringMapWrapper.forEach(map, function(value, key) {
        _this.map[key] = lang_1.isPresent(value) ? value.toString() : null;
        _this.keys[key] = true;
      });
    }
  }
  TouchMap.prototype.get = function(key) {
    collection_1.StringMapWrapper.delete(this.keys, key);
    return this.map[key];
  };
  TouchMap.prototype.getUnused = function() {
    var _this = this;
    var unused = {};
    var keys = collection_1.StringMapWrapper.keys(this.keys);
    keys.forEach(function(key) {
      return unused[key] = collection_1.StringMapWrapper.get(_this.map, key);
    });
    return unused;
  };
  return TouchMap;
})();
function normalizeString(obj) {
  if (lang_1.isBlank(obj)) {
    return null;
  } else {
    return obj.toString();
  }
}
var ContinuationSegment = (function() {
  function ContinuationSegment() {
    this.name = '';
  }
  ContinuationSegment.prototype.generate = function(params) {
    return '';
  };
  ContinuationSegment.prototype.match = function(path) {
    return true;
  };
  return ContinuationSegment;
})();
var StaticSegment = (function() {
  function StaticSegment(path) {
    this.path = path;
    this.name = '';
  }
  StaticSegment.prototype.match = function(path) {
    return path == this.path;
  };
  StaticSegment.prototype.generate = function(params) {
    return this.path;
  };
  return StaticSegment;
})();
var DynamicSegment = (function() {
  function DynamicSegment(name) {
    this.name = name;
  }
  DynamicSegment.prototype.match = function(path) {
    return path.length > 0;
  };
  DynamicSegment.prototype.generate = function(params) {
    if (!collection_1.StringMapWrapper.contains(params.map, this.name)) {
      throw new exceptions_1.BaseException("Route generator for '" + this.name + "' was not included in parameters passed.");
    }
    return normalizeString(params.get(this.name));
  };
  return DynamicSegment;
})();
var StarSegment = (function() {
  function StarSegment(name) {
    this.name = name;
  }
  StarSegment.prototype.match = function(path) {
    return true;
  };
  StarSegment.prototype.generate = function(params) {
    return normalizeString(params.get(this.name));
  };
  return StarSegment;
})();
var paramMatcher = /^:([^\/]+)$/g;
var wildcardMatcher = /^\*([^\/]+)$/g;
function parsePathString(route) {
  if (route.startsWith("/")) {
    route = route.substring(1);
  }
  var segments = splitBySlash(route);
  var results = [];
  var specificity = 0;
  if (segments.length > 98) {
    throw new exceptions_1.BaseException("'" + route + "' has more than the maximum supported number of segments.");
  }
  var limit = segments.length - 1;
  for (var i = 0; i <= limit; i++) {
    var segment = segments[i],
        match;
    if (lang_1.isPresent(match = lang_1.RegExpWrapper.firstMatch(paramMatcher, segment))) {
      results.push(new DynamicSegment(match[1]));
      specificity += (100 - i);
    } else if (lang_1.isPresent(match = lang_1.RegExpWrapper.firstMatch(wildcardMatcher, segment))) {
      results.push(new StarSegment(match[1]));
    } else if (segment == '...') {
      if (i < limit) {
        throw new exceptions_1.BaseException("Unexpected \"...\" before the end of the path for \"" + route + "\".");
      }
      results.push(new ContinuationSegment());
    } else {
      results.push(new StaticSegment(segment));
      specificity += 100 * (100 - i);
    }
  }
  var result = collection_1.StringMapWrapper.create();
  collection_1.StringMapWrapper.set(result, 'segments', results);
  collection_1.StringMapWrapper.set(result, 'specificity', specificity);
  return result;
}
function pathDslHash(segments) {
  return segments.map(function(segment) {
    if (segment instanceof StarSegment) {
      return '*';
    } else if (segment instanceof ContinuationSegment) {
      return '...';
    } else if (segment instanceof DynamicSegment) {
      return ':';
    } else if (segment instanceof StaticSegment) {
      return segment.path;
    }
  }).join('/');
}
function splitBySlash(url) {
  return url.split('/');
}
var RESERVED_CHARS = lang_1.RegExpWrapper.create('//|\\(|\\)|;|\\?|=');
function assertPath(path) {
  if (lang_1.StringWrapper.contains(path, '#')) {
    throw new exceptions_1.BaseException("Path \"" + path + "\" should not include \"#\". Use \"HashLocationStrategy\" instead.");
  }
  var illegalCharacter = lang_1.RegExpWrapper.firstMatch(RESERVED_CHARS, path);
  if (lang_1.isPresent(illegalCharacter)) {
    throw new exceptions_1.BaseException("Path \"" + path + "\" contains \"" + illegalCharacter[0] + "\" which is not allowed in a route config.");
  }
}
var PathRecognizer = (function() {
  function PathRecognizer(path) {
    this.path = path;
    this.terminal = true;
    assertPath(path);
    var parsed = parsePathString(path);
    this._segments = parsed['segments'];
    this.specificity = parsed['specificity'];
    this.hash = pathDslHash(this._segments);
    var lastSegment = this._segments[this._segments.length - 1];
    this.terminal = !(lastSegment instanceof ContinuationSegment);
  }
  PathRecognizer.prototype.recognize = function(beginningSegment) {
    var nextSegment = beginningSegment;
    var currentSegment;
    var positionalParams = {};
    var captured = [];
    for (var i = 0; i < this._segments.length; i += 1) {
      var segment = this._segments[i];
      currentSegment = nextSegment;
      if (segment instanceof ContinuationSegment) {
        break;
      }
      if (lang_1.isPresent(currentSegment)) {
        captured.push(currentSegment.path);
        if (segment instanceof StarSegment) {
          positionalParams[segment.name] = currentSegment.toString();
          nextSegment = null;
          break;
        }
        if (segment instanceof DynamicSegment) {
          positionalParams[segment.name] = currentSegment.path;
        } else if (!segment.match(currentSegment.path)) {
          return null;
        }
        nextSegment = currentSegment.child;
      } else if (!segment.match('')) {
        return null;
      }
    }
    if (this.terminal && lang_1.isPresent(nextSegment)) {
      return null;
    }
    var urlPath = captured.join('/');
    var auxiliary;
    var urlParams;
    var allParams;
    if (lang_1.isPresent(currentSegment)) {
      var paramsSegment = beginningSegment instanceof url_parser_1.RootUrl ? beginningSegment : currentSegment;
      allParams = lang_1.isPresent(paramsSegment.params) ? collection_1.StringMapWrapper.merge(paramsSegment.params, positionalParams) : positionalParams;
      urlParams = url_parser_1.serializeParams(paramsSegment.params);
      auxiliary = currentSegment.auxiliary;
    } else {
      allParams = positionalParams;
      auxiliary = [];
      urlParams = [];
    }
    return {
      urlPath: urlPath,
      urlParams: urlParams,
      allParams: allParams,
      auxiliary: auxiliary,
      nextSegment: nextSegment
    };
  };
  PathRecognizer.prototype.generate = function(params) {
    var paramTokens = new TouchMap(params);
    var path = [];
    for (var i = 0; i < this._segments.length; i++) {
      var segment = this._segments[i];
      if (!(segment instanceof ContinuationSegment)) {
        path.push(segment.generate(paramTokens));
      }
    }
    var urlPath = path.join('/');
    var nonPositionalParams = paramTokens.getUnused();
    var urlParams = url_parser_1.serializeParams(nonPositionalParams);
    return {
      urlPath: urlPath,
      urlParams: urlParams
    };
  };
  return PathRecognizer;
})();
exports.PathRecognizer = PathRecognizer;
