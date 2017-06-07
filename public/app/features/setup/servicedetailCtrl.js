define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
],
function (angular, _, dateMath) {
  'use strict';

  var module = angular.module('grafana.controllers');
  module.controller('ServiceDetailCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv) {
    $scope.init = function() {
      $scope.changeTab('conf');
    };

    $scope.changeTab = function(tab) {
      $scope.conf = false;
      $scope.review = false;
      $scope.metrics = false;
      $scope[tab] = true;
    };

    $scope.init();
  });

});
