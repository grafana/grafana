/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.filters', [])
  .filter('dateformat', ['dateformat', function(date) {
    return function(date) {
      console.log(date)
      return "ahoy!"
      //return String(date).replace(/\%VERSION\%/mg, version);
    }
  }]);
