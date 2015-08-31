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

      $scope.verifyEmailEnabled = false;
      $scope.autoAssignOrg = false;

      backendSrv.get('/api/user/signup/options').then(function(options) {
        $scope.verifyEmailEnabled = options.verifyEmailEnabled;
        $scope.autoAssignOrg = options.autoAssignOrg;
      });
    };

    $scope.submit = function() {
      if (!$scope.signUpForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/signup/step2', $scope.formModel).then(function(rsp) {
        console.log(rsp);
        //window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.init();

  });
});
