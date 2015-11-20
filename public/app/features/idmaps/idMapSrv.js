define([
  'angular',
  'lodash',
  './editorCtrl'
], function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('idMapSrv', function(datasourceSrv, $q, alertSrv, $rootScope) {
    var promiseCached;
    var MAP_REGEX = /\$map\(([\S]+)\)/g;

    this.init = function() {
      $rootScope.onAppEvent('refresh', this.clearCache, $rootScope);
      $rootScope.onAppEvent('setup-dashboard', this.clearCache, $rootScope);
    };

    this.clearCache = function() {
      promiseCached = null;
    };

    this.getSeriesListIdMap = function(seriesList, ctrl) {
      if (skipIdMapping(ctrl)) {
        return $q.when(null);
      }

      if (promiseCached) {
        return promiseCached;
      }

      promiseCached = getIDMap(extractIDs(seriesList), ctrl);
      return promiseCached;
    };

    this.getTemplateVariableIDMap = function(variable, ctrl) {
      if (skipIdMapping(ctrl)) {
        return $q.when(null);
      }
      var ids = _.pluck(variable.options, 'value');
      return getIDMap(ids, ctrl);
    };

    this.replaceID = function(target, map) {
      return target.replace(MAP_REGEX, function(match, captureGroup) {
        return map[captureGroup];
      });
    };

    function getIDMap(ids, ctrl) {
      var idMap = {};
      var promises = _.map(ids, function(id) {
        return datasourceSrv.get(ctrl.datasource).then(function(datasource) {
          return datasource.mapIdQuery(id, ctrl.idField, ctrl.nameField)
            .then(function(result) {
              idMap[id] = result;
            }).catch(errorHandler);
        }).catch(errorHandler);
      });

      return $q.all(promises).then(function() {
        return idMap;
      });
    }

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

    function skipIdMapping(ctrl) {
      return !ctrl.enabled || !ctrl.datasource;
    }

    // Now init
    this.init();
  });

});
