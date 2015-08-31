define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SignUpCtrl', function($scope, $location, contextSrv, backendSrv) {

    contextSrv.sidemenu = false;

    $scope.formModel = {};

    $scope.init = function() {
      var params = $location.search();
      $scope.formModel.orgName = params.email;
      $scope.formModel.email = params.email;
      $scope.formModel.username = params.email;
      $scope.formModel.code = params.code;
    };

    $scope.submit = function() {
      if (!$scope.signupForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/signup/step2', $scope.formModel).then(function(rsp) {
        if (rsp.code === 'redirect-to-select-org') {
          window.location.href = config.appSubUrl + '/profile/select-org?signup=1';
        } else {
          window.location.href = config.appSubUrl + '/';
        }
      });
    };

    $scope.init();

  });
});
