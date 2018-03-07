define([
  'angular',
  'app/core/config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SelectOrgCtrl', function($scope, backendSrv, contextSrv) {

    contextSrv.sidemenu = false;

    $scope.init = function() {
      $scope.getUserOrgs();
    };

    $scope.getUserOrgs = function() {
      backendSrv.get('/api/user/orgs').then(function(orgs) {
        $scope.orgs = orgs;
      });
    };

    $scope.setUsingOrg = function(org) {
      backendSrv.post('/api/user/using/' + org.orgId).then(function() {
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.init();

  });
});
