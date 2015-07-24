define(['angular', 'lodash'], function (angular, _) {
  'use strict';

  var module = angular.module('grafana.filters');

  module.filter('filterByTag', function() {
    return function(items, tag) {
      var filtered = [];
      if (!tag) {
        return items;
      }
      _.forEach((items || []), function(item) {
        if (_.indexOf(item.tags, tag) >= 0) {
          filtered.push(item);
        }
      });
      return filtered;
    };
  });
  module.filter('timeDuration', function() {
    return function(time) {
      var duration = new Date().getTime() - new Date(time).getTime();
      if (duration < 10000) {
        return "a few seconds ago";
      }
      if (duration < 60000) {
        var secs = Math.floor(duration/1000);
        return "for " + secs + " seconds";
      }
      if (duration < 3600000) {
        var mins = Math.floor(duration/1000/60);
        return "for " + mins + " minutes";
      }
      if (duration < 86400000) {
        var hours = Math.floor(duration/1000/60/60);
        return "for " + hours + " hours";
      }
      var days = Math.floor(duration/1000/60/60/24);
      return "for " + days + " days";
    };
  });

});
