define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
],
function (angular, _, dateMath) {
  'use strict';

  var module = angular.module('grafana.controllers');
  module.controller('ServiceDetailCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv) {
    $scope.init = function() {
      $scope.changeTab('conf');
    };

    $scope.changeTab = function(tab) {
      $scope.conf = false;
      $scope.review = false;
      $scope.metrics = false;
      $scope[tab] = true;
    };

    $scope.install = function(template) {
      backendSrv.get('/api/static/template/' + template).then(function(result) {
        $scope.template = result;
        $scope.checkeServie();
      });
    };

    $scope.checkeServie = function() {
      var queries = [{
        "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + $scope.detail.id + ".state",
        "aggregator": "sum",
        "downsample": "10m-sum",
      }];

      $scope.datasource.performTimeSeriesQuery(queries, dateMath.parse('now-10m', false).valueOf(), null).then(function (response) {
        if (_.isEmpty(response.data)) {
          throw Error;
        }
        $scope.saveDashboard();
        $scope.detail.status = 0;
      }).catch(function () {
        $scope.appEvent('alert-warning', ['服务探针未正确部署', '请检查您的探针部署信息']);
      });
    };

    $scope.saveDashboard = function(options) {
      $scope.template.system = contextSrv.user.systemId;
      $scope.template.id = null;
      backendSrv.saveDashboard($scope.template, options).then(function(data) {
        backendSrv.post("/api/dashboards/system", {DashId: data.id.toString(), SystemId: $scope.template.system});
        $scope.appEvent('alert-success', ['服务探针部署成功', '请在"指标浏览"中查找相应指标']);
      });
      $scope.dismiss();
    };

    $scope.init();
  });

});
