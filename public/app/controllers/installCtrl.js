define([
    'angular',
    'lodash',
    'config'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('InstallCtrl', function ($scope, backendSrv) {
      $scope.installSelect = {
        system: 0,
        service: ""
      };
      //would be hard code for a while
      $scope.services = ["Hadoop", "zookeeper", "JMX", "Mysql"];
      $scope.platform = ["Window", "Linux"];
      $scope.changeToken = function () {
        _.each(backendSrv.tokens, function (token) {
          if (token.name == $scope.installSelect.system) {
            $scope.token = token.key;
          }
        });
      };
    });

  });
