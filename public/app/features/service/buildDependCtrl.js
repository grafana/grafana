define([
    'angular',
    'lodash',
    'app/app',
  ],
  function (angular, _, app) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('BuildDependCtrl', function ($scope, $timeout, serviceDepSrv, jsPlumbService) {
      $scope.init = function () {};

      var toolkit = jsPlumbService.getToolkit("demoToolkit");

      // load palette data
      $scope.draggableTypes = [];
      serviceDepSrv.readInstalledService().then(function (response) {
        var services = response.data;
        var serviceIconMap = _.serviceIconMap();
        
        _.each(services, function (service) {
          $scope.draggableTypes.push({
            label: service.name,
            type : "node",
            icon : serviceIconMap[service.name]
          });
        });
      });

      serviceDepSrv.readServiceDependency().then(function (response) {
        var dependencies = {};
        if (!_.isNull(response.data)) {
          dependencies = angular.fromJson(_.last(response.data).attributes[0].value);
          
          $scope.updateId  = _.last(response.data).id;
          $scope.graphId   = _.last(response.data).attributes[0].id;
        }
        toolkit.load({ data: dependencies });
      });
          

      $scope.save = function () {
        var graph = angular.toJson(window.ctrl.exportData);
        if ($scope.updateId & $scope.graphId) {
          serviceDepSrv.updateServiceDependency(graph, $scope.updateId, $scope.graphId).then(function () {
            alertSrv.set("更新成功", "", "success", 4000);
          });
        } else {
          serviceDepSrv.createServiceDependency(graph).then(function () {
            alertSrv.set("创建成功", "", "success", 4000);
          });
        }
      };

    });
  }
);