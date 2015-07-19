define([
  'angular',
<<<<<<< e10a004f77a35c271848c113e6ad48ddcdccf129
  'config',
],
function (angular, config) {
=======
],
function (angular) {
>>>>>>> feat(invite): began work on invited signup view, also added backdrop to login view, #2353
  'use strict';

  var module = angular.module('grafana.controllers');

<<<<<<< e10a004f77a35c271848c113e6ad48ddcdccf129
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
=======
  module.controller('InvitedCtrl', function($scope, contextSrv) {

    contextSrv.sidemenu = false;

    $scope.init = function() {
>>>>>>> feat(invite): began work on invited signup view, also added backdrop to login view, #2353
    };

    $scope.init();

  });
});
