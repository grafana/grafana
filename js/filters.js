/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.filters', [])
.filter('stringSort', function() {
  return function(input) {
    return input.sort();
  };
}).filter('pinnedQuery', function(querySrv) {
  return function( items, pinned) {
    var ret = _.filter(querySrv.ids,function(id){
      var v = querySrv.list[id];
      if(!_.isUndefined(v.pin) && v.pin === true && pinned === true) {
        return true;
      }
      if((_.isUndefined(v.pin) || v.pin === false) && pinned === false) {
        return true;
      }
    });
    return ret;
  };
}).filter('slice', function() {
  return function(arr, start, end) {
    if(!_.isUndefined(arr)) {
      return arr.slice(start, end);
    }
  };
}).filter('stringify', function() {
  return function(arr, start, end) {
    if(!_.isUndefined(arr)) {
      return arr.toString();
    }
  };

}).filter('noXml', function() {
  return function(text) {
    if(!_.isString(text)) {
      return text;
    }
    return text.
      replace(/&/g, '&amp;').
      replace(/</g, '&lt;').
      replace(/>/g, '&gt;').
      replace(/'/g, '&#39;').
      replace(/"/g, '&quot;');
  };
}).filter('urlLink', function() {
  var  //URLs starting with http://, https://, or ftp://
    r1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim,
    //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
    r2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim,
    //Change email addresses to mailto:: links.
    r3 = /(\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,6})/gim;

  return function(text, target, otherProp) {
    if(!_.isString(text)) {
      return text;
    }
    _.each(text.match(r1), function(url) {
      text = text.replace(r1, "<a href=\"$1\" target=\"_blank\">$1</a>");
    });
    _.each(text.match(r2), function(url) {
      text = text.replace(r2, "$1<a href=\"http://$2\" target=\"_blank\">$2</a>");
    });
    _.each(text.match(r3), function(url) {
      text = text.replace(r3, "<a href=\"mailto:$1\">$1</a>");
    });
    return text;
  };
});