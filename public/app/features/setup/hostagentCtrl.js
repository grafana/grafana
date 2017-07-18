define([
  'angular',
  'lodash',
  'app/features/org/importAlertsCtrl'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostAgentCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv, $interval, $location, $controller, $q) {

    $scope.init = function() {
      $scope.type = '安装';
      $scope.installManual = false;
      $scope.orgId = contextSrv.user.orgId;
      $scope.systemId = contextSrv.user.systemId;
      $scope.alertServer = backendSrv.alertDUrl;
      $scope.token = backendSrv.getToken();
      $scope.system = _.find(contextSrv.systemsMap,{Id:contextSrv.user.systemId}).SystemsName;
      backendSrv.get('/api/static/hosts').then(function(result) {
        $scope.platform = result.hosts;
      });

      datasourceSrv.get("opentsdb").then(function (ds) {
        var url = document.createElement('a');
        url.href = ds.url;
        $scope.metricsServer = url.hostname;
      });

      backendSrv.getHostsNum().then(function (response) {
        contextSrv.hostNum = response;
        $scope.hostNum = response;
        if(contextSrv.hostNum) {
          $scope.installed = true;
          $scope.appEvent('alert-success', ['您已安装机器探针', "请继续安装机器探针,或安装服务探针"]);
        } else {
          contextSrv.sidemenu = false;
        }
      });
      $scope.inter = $interval($scope.getHosts,5000);

      $controller('ImportAlertsCtrl',{$scope: $scope});
    };

    $scope.getHosts = function() {
      if($scope.hostNum > contextSrv.hostNum){
        // 首台机器安装完成，自动加载模板
        if(contextSrv.hostNum == 0){
          contextSrv.hostNum = $scope.hostNum;
          $interval.cancel($scope.inter);
          $scope.createTemp();
        };
        contextSrv.hostNum = $scope.hostNum;
        $interval.cancel($scope.inter);
        $scope.installed = true;
      } else {
        backendSrv.getHostsNum().then(function (response) {
          $scope.hostNum = response;
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
        case "import":{
          backendSrv.get('/api/static/alertd/machine').then(function(result) {
            $scope.alertDefs = result.alertd;
            $scope.importAlerts($scope.alertDefs);
            return $scope.alertDef;
          }).catch(function(err) {
            $scope.appEvent('alert-warning', ['暂无报警规则', '请联系管理员']);
          });
          break;
        }
      }
    };

    $scope.createTemp = function(options) {
      // 添加模板
      var tmp = ["iostat","machine"];
      var promiseArr = [];
      _.each(tmp,function(template, i) {
        var p = backendSrv.get('/api/static/template/'+template).then(function(result) {
          result.system = contextSrv.user.systemId;
          result.id = null;
          return backendSrv.saveDashboard(result, options).then(function(data) {
            backendSrv.post("/api/dashboards/system", {DashId: data.id.toString(), SystemId: result.system});
            return 1;
          }, function(err) {
            $scope.appEvent('alert-warning', ['"'+err.config.data.dashboard.originalTitle + '"已存在']);
            return -1;
          });
        });
        promiseArr.push(p);
      });

      $q.all(promiseArr).then(function(valuse) {
        var success = _.filter(valuse,function(data) {
          return data > 0;
        });
        if(success.length) {
          $scope.appEvent('alert-success', ['机器探针部署成功', '共导入' + success.length + '个模板']);
        }
      });
    };

    $scope.$on("$destroy", function() {
      if($scope.inter){
        $interval.cancel($scope.inter);
      }
    });

    $scope.importAlerts = function(alertDefs) {
      if(alertDefs.length) {
        $scope.importAlert(alertDefs);
      } else {
        $scope.appEvent('alert-warning', ['暂无报警规则', '请联系管理员']);
      }
    };

    $scope.updateType = function(type) {
      $scope.type = type;
      if(type == '更新') {
        $scope.updateAuto = ' /dev/stdin -update';
        $scope.updateSelf = ' -update';
      } else {
        $scope.updateAuto = '';
        $scope.updateSelf = '';
      }
    };

    $scope.init();
  });

});
