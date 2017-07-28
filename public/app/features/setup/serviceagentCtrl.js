define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');
  module.controller('ServiceAgentCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv) {
    var NO_DATA = 2;
    var GET_DATA = 0;
    $scope.init = function() {
      $scope.getService();
    };

    $scope.getServiceStatus = function(services) {
      _.each(services, function (service,index) {
        var query = [{
          "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + service.id + ".state",
          "aggregator": "sum",
          "downsample": "1s-sum",
        }];
        var time = 'now-5m';
        datasourceSrv.getHostStatus(query, time).then(function(res) {
          if(res.status > 0) {
            $scope.services[index].status = NO_DATA;
          } else {
            $scope.services[index].status = GET_DATA;
          }
        });
      });
    };

    $scope.getService = function() {
      backendSrv.get('/api/static/hosts').then(function(result) {
        $scope.services = result.service;
        $scope.getServiceStatus(result.service);
      });
    };

    $scope.showDetail = function(detail) {
      var detailScope = $scope.$new();
      detailScope.datasource = $scope.datasource;
      detailScope.detail = detail;
      $scope.appEvent('show-modal', {
        src: 'public/app/features/setup/partials/service_detail.html',
        modalClass: 'modal-no-header invite-modal',
        scope: detailScope,
      });
    };

    $scope.init();
  });

});
