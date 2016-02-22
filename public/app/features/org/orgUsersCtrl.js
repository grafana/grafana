define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OrgUsersCtrl', function($scope, $http, backendSrv) {

    $scope.user = {
      loginOrEmail: '',
      role: 'Viewer',
    };

    $scope.users = [];
    $scope.pendingInvites = [];

    $scope.init = function() {
      $scope.get();
      $scope.editor = { index: 0 };
    };

    $scope.get = function() {
      backendSrv.get('/api/org/users').then(function(users) {
        $scope.users = users;
      });
      backendSrv.get('/api/org/invites').then(function(pendingInvites) {
        $scope.pendingInvites = pendingInvites;
      });
    };

    $scope.updateOrgUser = function(user) {
      backendSrv.patch('/api/org/users/' + user.userId, user);
    };

    $scope.removeUser = function(user) {
      $scope.appEvent('confirm-modal', {
        title: 'Do you want to remove the user?',
        text: 'The user will be removed from this organization!',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          backendSrv.delete('/api/org/users/' + user.userId).then($scope.get);
        }
      });

    };

    $scope.revokeInvite = function(invite, evt) {
      evt.stopPropagation();
      backendSrv.patch('/api/org/invites/' + invite.code + '/revoke').then($scope.get);
    };

    $scope.copyInviteToClipboard = function(evt) {
      evt.stopPropagation();
    };

    $scope.openInviteModal = function() {
      var modalScope = $scope.$new();
      modalScope.invitesSent = function() {
        $scope.get();
      };

      $scope.appEvent('show-modal', {
        src: './app/features/org/partials/invite.html',
        modalClass: 'modal-no-header invite-modal',
        scope: modalScope
      });
    };

    $scope.init();

  });
});
