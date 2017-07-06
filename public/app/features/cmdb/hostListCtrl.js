define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostListCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      $scope.searchHost = '';
      backendSrv.get('/api/static/alertd/host.list').then(function(result) {
        $scope.hosts = result.hosts;
      });
    };

    $scope.getDetail = function(host) {
      $location.url('/cmdb/hostlist/hostdetail?id='+host.id);
    };

    $scope.importList = function() {
      var newScope = $scope.$new();
      newScope.importHosts = $scope.importHosts;
      $scope.appEvent('show-modal', {
        src: 'app/features/cmdb/partials/import_host.html',
        modalClass: 'cmdb-import-host',
        scope: newScope,
      });
    };

    $scope.importHosts = function() {
      console.log('importHosts');
    };

    $scope.init();
  });
});