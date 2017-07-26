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

      $scope.save = function () {
        var graph = JSON.stringify(window.ctrl.exportData);
        serviceDepSrv.createServiceDependency(graph).then(function () {
          alertSrv.set("保存成功", "", "success", 4000);
        });
      };

    });
  }
);