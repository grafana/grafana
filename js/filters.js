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
});