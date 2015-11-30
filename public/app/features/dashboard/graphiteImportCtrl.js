define([
  'angular',
  'lodash',
  'app/core/utils/kbn'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('GraphiteImportCtrl', function($scope, datasourceSrv, dashboardSrv, $location) {
    $scope.options = {};

    $scope.init = function() {
      $scope.datasources = [];
      _.each(datasourceSrv.getAll(), function(ds) {
        if (ds.type === 'graphite') {
          $scope.options.sourceName = ds.name;
          $scope.datasources.push(ds.name);
        }
      });
    };

    $scope.listAll = function() {
      datasourceSrv.get($scope.options.sourceName).then(function(datasource) {
        $scope.datasource = datasource;
        $scope.datasource.listDashboards('').then(function(results) {
          $scope.dashboards = results;
        }, function(err) {
          var message = err.message || err.statusText || 'Error';
          $scope.appEvent('alert-error', ['Failed to load dashboard list from graphite', message]);
        });
      });
    };

    $scope.import = function(dashName) {
      $scope.datasource.loadDashboard(dashName).then(function(results) {
        if (!results.data || !results.data.state) {
          throw { message: 'no dashboard state received from graphite' };
        }

        graphiteToGrafanaTranslator(results.data.state, $scope.datasource.name);
      }, function(err) {
        var message = err.message || err.statusText || 'Error';
        $scope.appEvent('alert-error', ['Failed to load dashboard from graphite', message]);
      });
    };

    function graphiteToGrafanaTranslator(state, datasource) {
      var graphsPerRow = 2;
      var rowHeight = 300;
      var rowTemplate;
      var currentRow;
      var panel;

      rowTemplate = {
        title: '',
        panels: [],
        height: rowHeight
      };

      currentRow = angular.copy(rowTemplate);

      var newDashboard = dashboardSrv.create({});
      newDashboard.rows = [];
      newDashboard.title = state.name;
      newDashboard.rows.push(currentRow);

      _.each(state.graphs, function(graph, index) {
        if (currentRow.panels.length === graphsPerRow) {
          currentRow = angular.copy(rowTemplate);
          newDashboard.rows.push(currentRow);
        }

        panel = {
          type: 'graph',
          span: 12 / graphsPerRow,
          title: graph[1].title,
          targets: [],
          datasource: datasource,
          id: index + 1
        };

        _.each(graph[1].target, function(target) {
          panel.targets.push({ target: target });
        });

        currentRow.panels.push(panel);
      });

      window.grafanaImportDashboard = newDashboard;
      $location.path('/dashboard-import/' + kbn.slugifyForUrl(newDashboard.title));
    }
  });
});
