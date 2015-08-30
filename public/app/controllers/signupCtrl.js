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
      var email = $location.search().email;
      $scope.formModel.orgName = email;
      $scope.formModel.email = email;
      $scope.formModel.username = email;
    };

    $scope.submit = function() {
      if (!$scope.signupForm.$valid) {
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
