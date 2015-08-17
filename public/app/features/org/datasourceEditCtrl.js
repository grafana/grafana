define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');
  var datasourceTypes = [];

  module.controller('DataSourceEditCtrl', function($scope, $q, backendSrv, $routeParams, $location, datasourceSrv) {

    $scope.httpConfigPartialSrc = 'app/features/org/partials/datasourceHttpConfig.html';

    var defaults = {
      name: '',
      type: 'netcrunch'
    };

    $scope.init = function() {
      $scope.isNew = true;
      $scope.datasources = [];

      $scope.loadDatasourceTypes().then(function() {
        if ($routeParams.id) {
          $scope.getDatasourceById($routeParams.id);
        } else {
          $scope.current = angular.copy(defaults);
          $scope.typeChanged();
        }
      });
    };

    $scope.loadDatasourceTypes = function() {
      if (datasourceTypes.length > 0) {
        $scope.types = datasourceTypes;
        return $q.when(null);
      }

      return backendSrv.get('/api/datasources/plugins').then(function(plugins) {
        datasourceTypes = plugins;
        $scope.types = plugins;
      });
    };

    $scope.getDatasourceById = function(id) {
      backendSrv.get('/api/datasources/' + id).then(function(ds) {
        $scope.isNew = false;
        $scope.current = ds;
        $scope.typeChanged();
      });
    };

    $scope.typeChanged = function() {
      $scope.datasourceMeta = $scope.types[$scope.current.type];
    };

    $scope.updateFrontendSettings = function() {
      return backendSrv.get('/api/frontend/settings').then(function(settings) {
        config.datasources = settings.datasources;
        config.defaultDatasource = settings.defaultDatasource;
        datasourceSrv.init();
      });
    };

    $scope.testDatasource = function() {
      $scope.testing = { done: false };

      datasourceSrv.get($scope.current.name).then(function(datasource) {
        if (!datasource.testDatasource) {
          $scope.testing.message = 'Data source does not support test connection feature.';
          $scope.testing.status = 'warning';
          $scope.testing.title = 'Unknown';
          return;
        }

        return datasource.testDatasource().then(function(result) {
          $scope.testing.message = result.message;
          $scope.testing.status = result.status;
          $scope.testing.title = result.title;
        }, function(err) {
          if (err.statusText) {
            $scope.testing.message = err.statusText;
            $scope.testing.title = "HTTP Error";
          } else {
            $scope.testing.message = err.message;
            $scope.testing.title = "Unknown error";
          }
        });
      }).finally(function() {
        $scope.testing.done = true;
      });
    };

    $scope.saveChanges = function(test) {
      if (!$scope.editForm.$valid) {
        return;
      }

      if ($scope.current.id) {
        return backendSrv.put('/api/datasources/' + $scope.current.id, $scope.current).then(function() {
          $scope.updateFrontendSettings().then(function() {
            if (test) {
              $scope.testDatasource();
            } else {
              $location.path('datasources');
            }
          });
        });
      } else {
        return backendSrv.post('/api/datasources', $scope.current).then(function(result) {
          $scope.updateFrontendSettings();
          $location.path('datasources/edit/' + result.id);
        });
      }
    };

    $scope.init();

  });
});
