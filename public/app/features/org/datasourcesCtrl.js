define([
  'angular',
  'lodash'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DataSourcesCtrl', function($scope, $http, $q, backendSrv, datasourceSrv) {

    $scope.init = function() {
      $scope.datasources = [];
      $scope.getDatasources();
    };

    $scope.getDatasources = function() {
      var
        netCrunchDefaultDatasource = backendSrv.get('api/datasources/netcrunch'),
        otherDatasources = backendSrv.get('/api/datasources');

      $q.all([netCrunchDefaultDatasource, otherDatasources]).then(function(datasources) {
        var results;

        results = datasources[1];
        results.unshift(datasources[0]);
        $scope.datasources = results;
      });
    };

    $scope.remove = function(ds) {
      backendSrv.delete('/api/datasources/' + ds.id).then(function() {
        $scope.getDatasources();

        backendSrv.get('/api/frontend/settings').then(function(settings) {
          datasourceSrv.init(settings.datasources);
        });
      });
    };

    $scope.init();

  });
});
