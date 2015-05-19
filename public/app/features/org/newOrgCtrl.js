define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('NewOrgCtrl', function($scope, $http, backendSrv) {

    $scope.newOrg = {name: ''};

    $scope.createOrg = function() {
      backendSrv.post('/api/orgs/', $scope.newOrg).then($scope.getUserOrgs);
    };

  });
});
