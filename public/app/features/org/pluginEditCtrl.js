define([
  'angular',
  'lodash',
  'app/core/config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PluginEditCtrl', function($scope, pluginSrv, $routeParams) {
    $scope.init = function() {
      $scope.current = {};
      $scope.getPlugins();
    };

    $scope.getPlugins = function() {
      pluginSrv.get($routeParams.type).then(function(result) {
        $scope.current = _.clone(result);
      });
    };

    $scope.update = function() {
      $scope._update();
    };

    $scope._update = function() {
      pluginSrv.update($scope.current).then(function() {
        window.location.href = config.appSubUrl + "plugins";
      });
    };

    $scope.init();
  });
});