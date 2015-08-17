define([
  'angular',
  'lodash',
  'kbn',
  './directives',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GrafanaDatasource', function($q, backendSrv) {

    function GrafanaDatasource() {
    }

    GrafanaDatasource.prototype.query = function(options) {
      // get from & to in seconds
      var from = kbn.parseDate(options.range.from).getTime();
      var to = kbn.parseDate(options.range.to).getTime();

      return backendSrv.get('/api/metrics/test', { from: from, to: to, maxDataPoints: options.maxDataPoints });
    };

    GrafanaDatasource.prototype.metricFindQuery = function() {
      return $q.when([]);
    };

    return GrafanaDatasource;

  });

});
