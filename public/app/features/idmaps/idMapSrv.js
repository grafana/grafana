define([
  'angular',
  'lodash',
  './editorCtrl'
], function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('idMapSrv', function(datasourceSrv, $q, alertSrv) {
    var MAP_REGEX = /\$map\(([\S]+)\)/g;

    this.getSeriesListIdMap = function(seriesList, ctrl) {
      var ids = {};
      _.forEach(seriesList, function(series) {
        ids = _.merge(ids, extractIDs(series.alias));
      });
      return getIDMap(ids, ctrl);
    };

    this.getTemplateVariableIDMap = function(variable, ctrl) {
      var ids = _.pluck(variable.options, 'value');
      return getIDMap(ids, ctrl);
    };

    this.mapIDsInText = function(target, ctrl) {
      if (skipIdMapping(ctrl)) {
        return $q.when(target);
      }

      var ids = extractIDs(target);
      return getIDMap(ids, ctrl)
        .then(_.partial(this.replaceID, target))
        .catch(errorHandler);
    };

    this.replaceID = function(target, map) {
      var alerted = false;
      return target.replace(MAP_REGEX, function(match, captureGroup) {
        var name = map[captureGroup];
        if (name) {
          return name;
        }
        else if (!alerted) {
          alerted = true;
          errorHandler("'"+captureGroup+"' missing from datasource");
        }
        return captureGroup;
      });
    };

    function getIDMap(ids, ctrl) {
      if (skipIdMapping(ctrl)) {
        return $q.when(null);
      }

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

    function extractIDs(text) {
      var ids = {};
      text.replace(MAP_REGEX, function(match, captureGroup) {
        ids[captureGroup]=captureGroup;
      });
      return ids;
    }

    function skipIdMapping(ctrl) {
      return !ctrl.enabled || !ctrl.datasource;
    }

  });

});
