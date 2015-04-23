define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DashboardImportCtrl', function($scope, $http, backendSrv, datasourceSrv) {

    $scope.init = function() {
      $scope.datasources = [];
      $scope.sourceName = 'grafana';
      $scope.destName = 'grafana';
      $scope.imported = [];
      $scope.dashboards = [];
      $scope.infoText = '';
      $scope.importing = false;

      _.each(datasourceSrv.getAll(), function(ds, key) {
        if (ds.type === 'influxdb_08' || ds.type === 'elasticsearch') {
          $scope.sourceName = key;
          $scope.datasources.push(key);
        }
      });
    };

    $scope.startImport = function() {
      datasourceSrv.get($scope.sourceName).then(function(ds) {
        $scope.dashboardSource = ds;
        $scope.dashboardSource.searchDashboards('title:').then(function(results) {
          $scope.dashboards = results.dashboards;

          if ($scope.dashboards.length === 0) {
            $scope.infoText = 'No dashboards found';
            return;
          }

          $scope.importing = true;
          $scope.imported = [];
          $scope.next();
        }, function(err) {
          var resp = err.message || err.statusText || 'Unknown error';
          var message = "Failed to load dashboards from selected data source, response from server was: " + resp;
          $scope.appEvent('alert-error', ['Import failed', message]);
        });
      });
    };

    $scope.next = function() {
      if ($scope.dashboards.length === 0) {
        $scope.infoText = "Done! Imported " + $scope.imported.length + " dashboards";
      }

      var dash = $scope.dashboards.shift();
      if (!dash.title) {
        console.log(dash);
        return;
      }

      var infoObj = {name: dash.title, info: 'Importing...'};
      $scope.imported.push(infoObj);
      $scope.infoText = "Importing " + $scope.imported.length + '/' + ($scope.imported.length + $scope.dashboards.length);

      $scope.dashboardSource.getDashboard(dash.id).then(function(loadedDash) {
        backendSrv.saveDashboard(loadedDash).then(function() {
          infoObj.info = "Done!";
          $scope.next();
        }, function(err) {
          err.isHandled = true;
          infoObj.info = "Error: " + (err.data || { message: 'Unknown' }).message;
          $scope.next();
        });
      });
    };

    $scope.init();

  });
});
