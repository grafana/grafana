define([
  'angular',
  'lodash',
  'moment',
  './cmdbSetupCtrl',
], function(angular, _, moment) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostListCtrl', function ($scope, backendSrv, $location, $controller) {
    $scope.init = function() {
      $scope.searchHost = '';
      $scope.order = "'hostname'";
      $scope.desc = false;
      $scope.refreshTxt = '扫描';
      backendSrv.alertD({url:'/cmdb/host'}).then(function(result) {
        $scope.hosts = result.data;
        _.map($scope.hosts, function(host) {
          if(host.isVirtual) {
            return host.isVirtual = '是';
          } else if(host.isVirtual == false) {
            return host.isVirtual = '否';
          } else {
            return host.isVirtual = '未知';
          };
        });
      });
    };

    $scope.getDetail = function(host) {
      $location.url('/cmdb/hostlist/hostdetail?id='+host.id);
    };

    $scope.importList = function() {
      $controller('CMDBSetupCtrl',{$scope: $scope});
      var newScope = $scope.$new();
      newScope.importHosts = $scope.importHosts;
      newScope.getHost = $scope.getHost;
      newScope.fileChanged = $scope.fileChanged;
      $scope.appEvent('show-modal', {
        src: 'app/features/cmdb/partials/import_host.html',
        modalClass: 'cmdb-import-host',
        scope: newScope,
      });
    };

    $scope.refreshList = function() {
      $scope.refreshTxt = '<i class="fa fa-spinner"></i>';
      backendSrv.alertD({url:'/cmdb/scan', method: 'post'}).then(function(response) {
        if(response.status == 200) {
          $scope.appEvent('alert-success', ['扫描成功','请刷新查看列表']);
          $scope.refreshTxt = '扫描';
        }
      }, function(err) {
        $scope.refreshTxt = '扫描';
      });
    };

    $scope.orderBy = function(order) {
      $scope.order = "'"+ order +"'";
      $scope.desc = !$scope.desc;
    };

    $scope.exportList = function() {
      backendSrv.alertD({url:'/cmdb/host/export'}).then(function(response) {
        var data = response.data;
        var text = _.without(_.keys(data[0]), 'orgId', 'sysId', 'services').toString() + '\n';
        _.each(data, function(item) {
          text += initData(item);
          text += '\n'
        });
        var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
        window.saveAs(blob, 'cloudwiz_hosts_export.csv');
      });
    };

    var initData = function(obj) {
      var text = '';
      if (_.isObject(obj)) {
        delete obj['orgId'];
        delete obj['services'];
        delete obj['sysId'];
      }
      if(obj.createdAt) {
        obj.createdAt = moment.unix(obj.createdAt/1000).format();
      }
      for(var i in obj) {
        if(i === 'cpu') {
          text += obj[i].join(';');
          text += ',';
        } else if(_.isArray(obj[i])) {
          text += initData(obj[i]);
          text += ',';
        } else if(_.isObject(obj[i])) {
          delete obj[i]['orgId'];
          delete obj[i]['sysId'];
          if(obj[i].createdAt) {
            obj[i].createdAt = moment.unix(obj[i].createdAt/1000).format();
          }
          text += JSON.stringify(obj[i]).replace(/,/g,';');
        } else {
          text += obj[i];
          text += ',';
        }
      }
      return text;
    };

    $scope.init();
  });
});