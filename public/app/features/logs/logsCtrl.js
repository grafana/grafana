define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('LogsCtrl', function ($scope) {
      $scope.init = function () {
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
