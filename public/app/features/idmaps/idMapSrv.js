define([
  'angular',
  'lodash',
  './editorCtrl'
], function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('idMapSrv', function(datasourceSrv, $q, alertSrv, $rootScope) {
    var promiseCached;
    var idMap = {};
    var MAP_REGEX = /\$map\(([\S]+)\)/g;

    this.init = function() {
      $rootScope.onAppEvent('refresh', this.clearCache, $rootScope);
      $rootScope.onAppEvent('setup-dashboard', this.clearCache, $rootScope);
    };

    this.clearCache = function() {
      promiseCached = null;
      idMap = {};
    };

    this.getIdMap = function(seriesList, dashboard) {
      var ctrl = dashboard.idMapping;
      if (!ctrl.enabled || !ctrl.datasource) {
        return $q.when(null);
      } else {

        if (promiseCached) {
          return promiseCached;
        }

        var promises = _.map(extractIDs(seriesList), function(id) {
          return datasourceSrv.get(ctrl.datasource).then(function(datasource) {
            return datasource.mapIdQuery(id, ctrl.idField, ctrl.nameField)
              .then(function(result) {
                idMap[id] = result;
              })
              .catch(errorHandler);
          });
        });

        promiseCached = $q.all(promises)
        .then(function() {
          return idMap;
        });

        return promiseCached;
      }
    };

    this.replaceID = function(target, map) {
      return target.replace(MAP_REGEX, function(match, captureGroup) {
        return map[captureGroup];
      });
    };

    function errorHandler(err) {
      console.log('ID mapping error: ', err);
      var message = err.message || "ID mapping query failed";
      alertSrv.set('ID mapping error', message,'error');
    }

    function extractIDs(seriesList) {
      var ids = {};
      _.forEach(seriesList, function(series) {
        series.alias.replace(MAP_REGEX, function(match, captureGroup) {
          ids[captureGroup]=captureGroup;
        });
      });
      return ids;
    }

    // Now init
    this.init();
  });

});
