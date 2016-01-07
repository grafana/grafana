define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('sample.services');

  module.factory('SampleDatasource', function($q, backendSrv) {

    function SampleDatasource() {
    }

    SampleDatasource.prototype.query = function(options) {
      return backendSrv.get('/api/metrics/test', {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        maxDataPoints: options.maxDataPoints
      });
    };

    SampleDatasource.prototype.metricFindQuery = function() {
      return $q.when([]);
    };

    return SampleDatasource;

  });

});
