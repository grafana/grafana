define([
    'angular',
    'lodash',
    'app/app',
    'sigma',
    'sigma-edge',
  ],
  function (angular, _, app, sigma) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('BuildDependCtrl', function ($scope, popoverSrv, backendSrv) {
      $scope.init = function () {};

      $scope.readInstalledService = function () {
        backendSrv.alertD({
          url: "/cmdb/service/status"
        }).then(function (response) {
          var errorServices = response.error;
          var normalServices = response.normal;
          $scope.services = Object.keys(errorServices).concat(Object.keys(normalServices));
        });
      };

      $scope.createServiceDependency = function (graph) {
        backendSrv.alertD({
          method: "post",
          url: "/cmdb/service/depend",
          data: angular.toJson(graph),
          headers: {'Content-Type': 'text/plain'}
        });
      };

      $scope.updateServiceDependency = function (graph) {
        backendSrv.alertD({
          method: "PUT",
          url: "/cmdb/service/depend?id=" + $scope.updateId + "&aid=" + $scope.graphId,
          data: angular.toJson(graph),
          headers: {'Content-Type': 'text/plain'}
        });
      };

      $scope.readServiceDependency = function () {
        backendSrv.alertD({
          url: "/cmdb/service/depend"
        }).then(function (response) {
          if (!_.isNull(response.data)) {
            var dependencies = angular.fromJson(response.data[0].attributes[0].value);
            $scope.updateId = response.data[0].id;
            $scope.graphId = response.data[0].attributes[0].id;
            // $scope.rcaGraph.refresh();
          }
        });
      };

    });
  }
);