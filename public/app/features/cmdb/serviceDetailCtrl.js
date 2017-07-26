define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ServiceDetailCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      var id = $location.search().id;
      backendSrv.alertD({url:'/cmdb/service'}).then(function(response) {
        $scope.list = response.data;
      });
      backendSrv.alertD({url:'/cmdb/service?id='+id}).then(function(response) {
        $scope.detail = response.data;
        $scope.detail = initDetail($scope.detail);
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
    };

    var initDetail = function(obj) {
      if(_.isObject(obj)) {
        for(var i in obj) {
          if(!_.isNumber(obj[i]) && (_.isNull(obj[i]) || _.isEmpty(obj[i]))){
            if(i == 'memory') {
              obj[i] = null;
            } else {
              obj[i] = '暂无信息';
            }
          };
          if(_.isObject(obj[i])) {
            obj[i] = initDetail(obj[i]);
          }
        }
      }
      return obj;
    }

    $scope.init();
  });
});