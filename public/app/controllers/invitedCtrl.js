define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InvitedCtrl', function($scope, $routeParams, contextSrv, backendSrv) {

    contextSrv.sidemenu = false;

    $scope.user = {};

    $scope.init = function() {
      backendSrv.get('/api/user/invite/' + $routeParams.code).then(function(invite) {
        $scope.user.name = invite.name;
        $scope.user.email = invite.email;
        $scope.user.username = invite.email;
        $scope.user.inviteId =  invite.id;

        $scope.greeting = invite.name || invite.email;
      });
    };

    $scope.submit = function() {
    };

    $scope.init();

  });
});
