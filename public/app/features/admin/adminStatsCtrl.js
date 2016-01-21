define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminStatsCtrl', function($scope) {

    $scope.init = function() {
      $scope.getStats();
    };

    $scope.getStats = function() {
//      backendSrv.get('/api/admin/stats').then(function(stats) {
//        $scope.stats = stats;
//      });
    };

    $scope.init();

  });
});
