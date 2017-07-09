define([
    'angular',
    '../core_module',
],
function (angular, coreModule) {
    'use strict';

    coreModule.default.controller('SystemCtrl', function ($scope, backendSrv, $location) {

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
      };

      $scope.init_system_choice = function () {
        backendSrv.get("/api/user/system").then(function (system) {
          $scope.systems = system;
        });
      };

      $scope.newSystem = function() {
        $location.url('/org');
      };
    });
  });
