define([
  'angular',
  'app/core/config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PluginsCtrl', function($scope, $location, pluginSrv) {

    $scope.init = function() {
      $scope.plugins = {};
      $scope.getPlugins();
    };

    $scope.getPlugins = function() {
      pluginSrv.getAll().then(function(result) {
        console.log(result);
        $scope.plugins = result;
      });
    };

    $scope.update = function(plugin) {
      pluginSrv.update(plugin).then(function() {
        window.location.href = config.appSubUrl + $location.path();
      });
    };

    $scope.init();

  });
});