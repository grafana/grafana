define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('UserInviteCtrl', function($scope, backendSrv, $q) {

    $scope.invites = [
      {name: '', email: '', role: 'Editor'},
    ];

    $scope.init = function() {
    };

    $scope.addInvite = function() {
      $scope.invites.push({name: '', email: '', role: 'Editor'});
    };

    $scope.removeInvite = function(invite) {
      $scope.invites = _.without($scope.invites, invite);
    };

    $scope.sendInvites = function() {
      if (!$scope.inviteForm.$valid) { return; }

      var promises = _.map($scope.invites, function(invite) {
        return backendSrv.post('/api/org/invites', invite);
      });

      $q.all(promises).then(function() {
        $scope.invitesSent();
      });

      $scope.dismiss();
    };
  });
});
