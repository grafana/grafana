define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GrafanaDatasource', function($q, backendSrv) {

    function GrafanaDatasource() {
    }

    GrafanaDatasource.prototype.query = function(options) {
      return backendSrv.get('/api/metrics/test', {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        maxDataPoints: options.maxDataPoints
      });
    };

    GrafanaDatasource.prototype.metricFindQuery = function() {
      return $q.when([]);
    };

    return GrafanaDatasource;

  });

});
