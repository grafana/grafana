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
      $scope.init = function () {
        backendSrv.get('/api/auth/keys').then(function (tokens) {
          $scope.tokens = tokens;
        });
      };

      $scope.changeToken = function () {
        _.each($scope.tokens, function (token) {
          if (token.name == $scope.installSelect.system) {
            $scope.token = token.key;
          }
        });
      };
    });

  });
