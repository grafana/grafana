define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('MixedDatasource', function($q, backendSrv, datasourceSrv) {

    function MixedDatasource() {
    }

    MixedDatasource.prototype.query = function(options) {
      var sets = _.groupBy(options.targets, 'datasource');
      var promises = _.map(sets, function(targets) {
        return datasourceSrv.get(targets[0].datasource).then(function(ds) {
          var opt = angular.copy(options);
          opt.targets = targets;
          return ds.query(opt);
        });
      });

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(_.pluck(results, 'data')) };
      });

    };

    return MixedDatasource;

  });

});
