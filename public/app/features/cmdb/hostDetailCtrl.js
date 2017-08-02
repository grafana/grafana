define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostDetailCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      var id = $location.search().id;
      backendSrv.alertD({url:'/cmdb/host'}).then(function(response) {
        $scope.list = response.data;
      });
      backendSrv.alertD({url:'/cmdb/host?id='+id}).then(function(response) {
        $scope.detail = response.data;
        $scope.cpuCount = _.countBy(response.data.cpu);
        $scope.detail.isVirtual = $scope.detail.isVirtual ? '是' : '否';
        $scope.detail = initDetail($scope.detail);
      });
    };

    var initDetail = function(obj) {
      if(_.isObject(obj)) {
        for(var i in obj) {
          if(!_.isNumber(obj[i]) && (_.isNull(obj[i]) || _.isEmpty(obj[i]))){
            if(i === 'memory') {
              obj[i] = null;
            } else {
              obj[i] = '暂无信息';
            }
          }
          if(_.isObject(obj[i])) {
            obj[i] = initDetail(obj[i]);
          }
        }
      }
      return obj;
    };

    $scope.init();
  });
});