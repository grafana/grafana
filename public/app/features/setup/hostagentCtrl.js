define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostAgentCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv, $interval, $location) {

    $scope.init = function() {
      $scope.installManual = false;
      $scope.hostNum = contextSrv.hostNum;
      $scope.orgId = contextSrv.user.orgId;
      $scope.alertServer = backendSrv.alertDUrl;
      $scope.token = backendSrv.getToken();
      $scope.system = _.find(contextSrv.systemsMap,{Id:contextSrv.user.systemId}).SystemsName;
      if(contextSrv.hostNum) {
        $scope.installed = true;
        $scope.appEvent('alert-success', ['您已安装机器探针', "请继续安装机器探针,或安装服务探针"]);
      } else {
        contextSrv.sidemenu = false;
      }
      backendSrv.get('/api/static/hosts').then(function(result) {
        $scope.platform = result.hosts;
      });

      datasourceSrv.get("opentsdb").then(function (ds) {
        var url = document.createElement('a');
        url.href = ds.url;
        $scope.metricsServer = url.hostname;
      });
      $scope.inter = $interval($scope.getHosts,5000,120);
    };

    $scope.getHosts = function() {
      if($scope.hostNum > contextSrv.hostNum){
        contextSrv.hostNum = $scope.hostNum;
        $interval.cancel($scope.inter);
        $scope.installed = true;
        // 首台机器安装完成，自动加载模板
        if(contextSrv.hostNum == 1){
          $scope.createTemp();
        };
      } else {
        backendSrv.alertD({
          method: "get",
          url: "/summary",
          params: {metrics:"collector.summary"},
          headers: {'Content-Type': 'text/plain'},
        }).then(function (response) {
          $scope.hostNum = response.data.length;
        });
      }
    };

    $scope.changeSelect = function(select) {
      $scope.selected = select;
    };

    $scope.nextEvent = function(type) {
      switch (type) {
        case "next":
          contextSrv.sidemenu = true;
          $location.url('/setting/service');
          break;
        case "back":
          $location.url('/systems');
          break;
        case "skip":
          $location.url('/');
          break;
      }
    };

    $scope.createTemp = function(options) {
      // 添加模板
      var tmp = ["iostat","machine"];
      _.each(tmp,function(template) {
        backendSrv.get('/api/static/template/'+template).then(function(result) {
          result.system = contextSrv.user.systemId;
          result.id = null;
          backendSrv.saveDashboard(result, options).then(function(data) {
            backendSrv.post("/api/dashboards/system", {DashId: data.id.toString(), SystemId: result.system});
          });
        });
      });
      $scope.appEvent('alert-success', ['机器探针部署成功', '请在"指标浏览"中查找相应指标']);
    };

    $scope.$on("$destroy", function() {
      if($scope.inter){
        $interval.cancel($scope.inter);
      }
    });

    $scope.init();
  });

});
