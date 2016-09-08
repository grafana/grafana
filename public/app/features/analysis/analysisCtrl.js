define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AnalysisCtrl', function ($scope, $location) {
      $scope.init = function () {
        var targetObj = {
          metric:"usage_rate",
          host:"User.Utilization"
        };
        $scope.targetObj = targetObj;
      };

      $scope.analysis = function() {
        var target = {"metric":$scope.targetObj.metric,"tags":{"host":$scope.targetObj.host}};
        window.decomposeTarget = target;
        $location.path("/decompose");
      }
      $scope.init();
    });
  });
