define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SaveDashboardMessageCtrl', function($scope, dashboardSrv) {

    $scope.init = function() {
      $scope.clone.message = '';
      $scope.clone.max = 64;
    };

    function saveDashboard(options) {
      options.message = $scope.clone.message;
      return dashboardSrv.save($scope.clone, options)
        .then(function() { $scope.dismiss(); });
    }

    $scope.saveVersion = function(isValid) {
      if (!isValid) { return; }
      saveDashboard({overwrite: false});
    };
  });

});

