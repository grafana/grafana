define([
  'angular',
  'lodash',
  'app/features/org/importAlertsCtrl'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');
  module.controller('ServiceDetailCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv, $controller) {
    var NO_DATA = 2;
    var GET_DATA = 0;
    var NO_SERVER = -1;

    $scope.init = function() {
      $scope.changeTab('conf');
      if($scope.detail.status == NO_SERVER) {
        $scope.installBtn = "安装并导入模板";
      } else {
        $scope.installBtn = "导入模板";
      };

      $controller('ImportAlertsCtrl',{$scope: $scope});
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

      datasourceSrv.getHostStatus(queries, 'now-10m').then(function(response) {
        $scope.saveDashboard();
        $scope.detail.status = response.status > 0 ? NO_DATA : GET_DATA;
      },function(err) {
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

    $scope.importAlerts = function(service) {
      backendSrv.get('/api/static/alertd/'+service).then(function(result) {
        var alertDefs = result.alertd;
        if(alertDefs.length) {
          $scope.importAlert(alertDefs);
        } else {
          $scope.appEvent('alert-warning', ['暂无报警规则', '请联系管理员']);
        }
      }).catch(function(err) {
        $scope.appEvent('alert-warning', ['暂无报警规则', '请联系管理员']);
      });
    };

    $scope.init();
  });

});
