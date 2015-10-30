define([
  'angular',
  'app/core/config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InvitedCtrl', function($scope, $routeParams, contextSrv, backendSrv) {

    contextSrv.sidemenu = false;

    $scope.formModel = {};

    $scope.init = function() {
      backendSrv.get('/api/user/invite/' + $routeParams.code).then(function(invite) {
        $scope.formModel.name = invite.name;
        $scope.formModel.email = invite.email;
        $scope.formModel.username = invite.email;
        $scope.formModel.inviteCode =  $routeParams.code;

        $scope.greeting = invite.name || invite.email || invite.username;
        $scope.invitedBy = invite.invitedBy;
      });
    };

    $scope.submit = function() {
      if (!$scope.inviteForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/invite/complete', $scope.formModel).then(function() {
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.init();

  });
});
