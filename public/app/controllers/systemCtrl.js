define([
    'angular',
    'lodash',
    'config',
  ],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SystemCtrl', function ($scope, backendSrv, $location) {

      $scope.dashboardSetting = {title: "新的仪表盘", system: null};
      $scope.init = function () {
        $scope.getCurrentUserSystem();
      };

      $scope.getCurrentUserSystem = function () {
        backendSrv.get("/api/user/system").then(function (system) {
          $scope.systems = system;
        })

      };

      $scope.addSystem = function () {
        if (!$scope.systemForm.$valid) {
          return;
        }
        $scope.dismiss();
        $location.url('dashboard/new?system=' + $scope.dashboardSetting.system + "&title=" + $scope.dashboardSetting.title);
      }

    });
  });
