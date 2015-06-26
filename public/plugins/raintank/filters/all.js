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
});
