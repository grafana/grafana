define([
    'angular',
    '../core_module',
],
function (angular, coreModule) {
    'use strict';

    coreModule.default.controller('SignupFreeCtrl', function ($scope, $location, backendSrv, contextSrv) {
      $scope.formModel = {};
      contextSrv.sidemenu = false;
      $scope.init = function () {
        $scope.formModel.email = $location.search().email;
        $scope.formModel.username = "";
        $scope.formModel.orgName = "";
        $scope.formModel.phone = "";
        $scope.formModel.scale = "";
      };

      $scope.submit = function () {
        if (!$scope.signUpFrom.$valid) {
          return;
        }
        backendSrv.post('/api/user/signup/propose', $scope.formModel).then(function () {
          $scope.appEvent('alert-success', ['申请成功', "很快会有人与您联系, 请保持通话"]);
          $scope.formModel = {};
        });
      };

      $scope.init();
    });
  });
