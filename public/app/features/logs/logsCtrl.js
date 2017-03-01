define([
    'angular',
    'lodash'
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('LogsCtrl', function ($scope, $sce) {
      $scope.init = function () {
        $scope.iframeSrc = $sce.trustAsResourceUrl("https://elk.cloudwiz.cn/app/kibana#/discover?_g=(refreshInterval:(display:Off,pause:!f,value:0),time:(from:'"+$scope.from+"',mode:absolute,to:'"+$scope.to+"'))&_a=(columns:!(_source),index:'10002-all',interval:auto,query:(query_string:(analyze_wildcard:!t,query:'*')),sort:!('@timestamp',desc))");
        var logs = {
          keywords:"*",
          type:"OS",
          start:"5",
          startUnit:"d",
          end:"now",
          endUnit:""
        };
        $scope.logs = logs;
      };
      $scope.init();
    });
  });
