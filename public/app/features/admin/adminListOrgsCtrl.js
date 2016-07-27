define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminListOrgsCtrl', function($scope, backendSrv) {

    $scope.init = function() {
      $scope.getOrgs();
    };

    $scope.getOrgs = function() {
      backendSrv.get('/api/orgs').then(function(orgs) {
        $scope.orgs = orgs;
      });
    };

    $scope.deleteOrg = function(org) {
      $scope.appEvent('confirm-modal', {
        title: '你想删除 ' + org.name + ' 公司吗?',
        text: '公司的成员和所有的仪表盘(资料)都会被清除',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          backendSrv.delete('/api/orgs/' + org.id).then(function() {
            $scope.getOrgs();
          });
        }
      });
    };

    $scope.init();

  });

});
