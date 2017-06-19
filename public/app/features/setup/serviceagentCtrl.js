define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
],
function (angular, _, dateMath) {
  'use strict';

  var module = angular.module('grafana.controllers');
  module.controller('ServiceAgentCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv) {
    const NO_DATA = 2;
    const GET_DATA = 0;
    $scope.init = function() {
      datasourceSrv.get("opentsdb").then(function (datasource) {
        $scope.datasource = datasource;
      }).then(function () {
        $scope.getService();
      });
    };

    $scope.getService = function() {
      backendSrv.get('/api/static/hosts').then(function(result) {
        $scope.services = result.service;
        $scope.getServiceStatus(result.service);
      });
    };

    $scope.getServiceStatus = function(services) {
      _.each(services, function (service, index) {
        var queries = [{
          "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + service.id + ".state",
          "aggregator": "sum",
          "downsample": "10m-sum",
        }];

        $scope.datasource.performTimeSeriesQuery(queries, dateMath.parse('now-10m', false).valueOf(), null).then(function (response) {
          if (_.isEmpty(response.data)) {
            throw Error;
          }
          _.each(response.data, function (metricData) {
            if (_.isObject(metricData)) {
              if (metricData.dps[Object.keys(metricData.dps)[0]] > 0) {
                // 安装成功,但未获取数据
                $scope.services[index].status = NO_DATA;
              } else {
                // 安装成功,且配置正确
                $scope.services[index].status = GET_DATA;
              }
            }
          });
        }).catch(function () {
        // nothing to do
        });
      });
    };

    $scope.showDetail = function(detail) {
      var detailScope = $scope.$new();
      detailScope.datasource = $scope.datasource;
      detailScope.detail = detail;
      $scope.appEvent('show-modal', {
        src: 'app/features/setup/partials/service_detail.html',
        modalClass: 'modal-no-header invite-modal',
        scope: detailScope,
      });
    };

    $scope.init();
  });

});
