define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GrafanaDatasource', function($q, backendSrv, datasourceSrv) {

    function GrafanaDatasource() {
    }

    GrafanaDatasource.prototype.query = function(options) {
<<<<<<< a07e6ed8cd8b3dcf9178d85421158e05a7a4518a
      return backendSrv.get('/api/metrics/test', {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        maxDataPoints: options.maxDataPoints
      });
=======
      return datasourceSrv.get(options.targets[0].datasource).then(function(ds) {
        options.targets = [options.targets[0]];
        return ds.query(options);
      });
      // console.log(options.targets);
      // // get from & to in seconds
      // var from = kbn.parseDate(options.range.from).getTime();
      // var to = kbn.parseDate(options.range.to).getTime();
      //
      // return backendSrv.get('/api/metrics/test', { from: from, to: to, maxDataPoints: options.maxDataPoints });
>>>>>>> feat(mutli db query): major changes to query editor and data source handling, looks promising
    };

    GrafanaDatasource.prototype.metricFindQuery = function() {
      return $q.when([]);
    };

    return GrafanaDatasource;

  });

});
