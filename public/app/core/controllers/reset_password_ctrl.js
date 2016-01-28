define([
  'angular',
  '../core_module',
],
function (angular, coreModule) {
  'use strict';

  coreModule.controller('ResetPasswordCtrl', function($scope, contextSrv, backendSrv, $location) {
    contextSrv.sidemenu = false;
    $scope.formModel = {};
    $scope.mode = 'send';

    var params = $location.search();
    if (params.code) {
      $scope.mode = 'reset';
      $scope.formModel.code = params.code;
    }

    $scope.sendResetEmail = function() {
      if (!$scope.sendResetForm.$valid) {
        return;
      }
      backendSrv.post('/api/user/password/send-reset-email', $scope.formModel).then(function() {
        $scope.mode = 'email-sent';
      });
    };

    $scope.submitReset = function() {
      if (!$scope.resetForm.$valid) { return; }

      if ($scope.formModel.newPassword !== $scope.formModel.confirmPassword) {
        $scope.appEvent('alert-warning', ['New passwords do not match', '']);
        return;
      }

      backendSrv.post('/api/user/password/reset', $scope.formModel).then(function() {
        $location.path('login');
      });
    };

  });

});
