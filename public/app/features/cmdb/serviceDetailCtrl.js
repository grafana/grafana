define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ServiceDetailCtrl', function ($scope, backendSrv, $location, $q) {
    $scope.init = function() {
      $scope.order = "'hostname'";
      $scope.desc = false;
      $scope.serviceId = parseInt($location.search().id);
      backendSrv.alertD({url:'/cmdb/service'}).then(function(response) {
        $scope.list = response.data;
      });
      getServiceDetail();
    };

    $scope.deleteHost = function(relationshipId) {
      $scope.appEvent('confirm-modal', {
        title: '删除',
        text: '您确认要删除该机器吗？',
        icon: 'fa-trash',
        yesText: '删除',
        noText: '取消',
        onConfirm: function() {
          backendSrv.editServiceHost({op: 'Delete', rId: relationshipId}).then(function(response) {
            if (response.status === 200) {
              _.remove($scope.detail.hosts, {'relationshipId': relationshipId});
            }
          });
        }
      });
    };

    $scope.showHost = function() {
      backendSrv.alertD({url:'/cmdb/host'}).then(function(result) {
        $scope.allHosts = result.data;
        _.each($scope.detail.hosts, function(host) {
          _.remove($scope.allHosts, function(item) {
            return item.id === host.id;
          });
        });

        if(!$scope.allHosts.length) {
          $scope.appEvent('alert-success', ['您已添加所有机器']);
          return;
        }

        var newScope = $scope.$new();
        newScope.detail = $scope.detail;
        newScope.allHosts = $scope.allHosts;
        newScope.selectOne = function() {
          newScope.select_all = _.every($scope.allHosts,{'checked': true});
        };
        $scope.appEvent('show-modal', {
          src: 'app/features/cmdb/partials/service_add_host.html',
          modalClass: 'modal-no-header invite-modal cmdb-modal',
          scope: newScope,
        });
      });
    };

    $scope.selectAll = function(check) {
      _.each($scope.allHosts, function(host) {
        host.checked = check;
      });
    };

    $scope.addHosts = function() {
      var hosts = _.where($scope.allHosts, {'checked': true});
      var promiseArr = [];
      _.each(hosts, function(host) {
        var p = backendSrv.editServiceHost({op: 'Create', sourceId: host.id, targetId: $scope.serviceId, type: 'Member_of'}).then(function(response) {
          if(response.status === 200) {
            return true;
          }
        }, function(err) {
          return false;
        });
        promiseArr.push(p);
      });

      $q.all(promiseArr).then(function(values) {
        getServiceDetail();
      });
    };

    var getServiceDetail = function() {
      backendSrv.alertD({url:'/cmdb/service?id='+$scope.serviceId}).then(function(response) {
        $scope.detail = _.cmdbInitObj(response.data);
        _.map($scope.detail.hosts, function(host) {
          if(host.isVirtual) {
            return host.isVirtual = '是';
          } else if(host.isVirtual == false) {
            return host.isVirtual = '否';
          } else {
            return host.isVirtual = '未知';
          };
        });
      });
    }

    $scope.orderBy = function(order) {
      $scope.order = "'"+ order +"'";
      $scope.desc = !$scope.desc;
    };

    $scope.init();
  });
});