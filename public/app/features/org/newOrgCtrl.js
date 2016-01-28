define([
  'angular',
  'app/core/config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('NewOrgCtrl', function($scope, $http, backendSrv) {

    $scope.newOrg = {name: ''};

    $scope.createOrg = function() {
      backendSrv.post('/api/orgs/', $scope.newOrg).then(function(result) {
        backendSrv.post('/api/user/using/' + result.orgId).then(function() {
          window.location.href = config.appSubUrl + '/org';
        });
      });
    };

  });
});
