define([
    'angular',
    'lodash',
    'app/app',
  ],
  function (angular, _, app) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ServiceStatusCtrl', function ($scope, $timeout, serviceDepSrv, jsPlumbService) {
      var toolkit = jsPlumbService.getToolkit("demoToolkit");
      var surface = jsPlumbService.getSurface("demoSurface");

      $scope.service = {};

      $scope.init = function (scope, element, attrs) {
        toolkit = window.toolkit = scope.toolkit;
        serviceDepSrv.readServiceDependency().then(function (response) {
          if (!_.isNull(response.data)) {
            var dependencies = angular.fromJson(_.last(response.data).attributes[0].value);
            $scope.updateId = _.last(response.data).id;
            $scope.graphId = _.last(response.data).attributes[0].id;
            toolkit.load({ data: JSON.parse(dependencies) });
          }
        });
      };

      $scope.nodeClickHandler = function (node) {
        var service = $(node.el).attr("data-jtk-node-id");
        serviceDepSrv.readHostStatus(service).then(function (response) {
          var hosts = [];
          $scope.service.hosts = [];
          if (!_.isNull(response.data)) {
            response = response.data;
            hosts = response.hostStatusMap.keys();
            _.each(hosts, function (host) {
              var hostInfo = response.hostStatusMap[host];
              // $scope.$apply(function () {
                $scope.service.hosts.push({
                  hostName: hostInfo.hostName,
                  healthStatusType: hostInfo.itemStatusMap.ServiceState.healthStatusType
                });
              // })
            });
          }
          $scope.$apply();
        });
        
      };

      $scope.selectHost = function(index, host) {
        $scope.selected = ($scope.selected == index) ? -1 : index;

        serviceDepSrv.readMetricStatus(service, host).then(function (response) {
          if (!_.isNull(response.data)) {
            response = response.data;
            $scope.itemStatusMap = response.hostStatusMap[host].itemStatusMap;
            $scope.service.healthItemType = [];
            _.each($scope.itemStatusMap.keys(), function (itemType) {
              var healthItemTypeInfo = response.hostStatusMap[host].itemStatusMap[itemType];
              $scope.service.healthItemType.push({
                itemType: healthItemTypeInfo.type,
                itemTypeStatus: healthItemTypeInfo.healthStatusType
              });
            });
          }
        });
      };

      $scope.selectHealthItemType = function (itemType) {
        var metrics = $scope.itemStatusMap[itemType].metricStatusMap.keys();
        $scope.service.metrics = [];
        _.each(metrics, function (metric) {
          var metricInfo = $scope.itemStatusMap[itemType].metricStatusMap[metric];
          $scope.service.metrics.push({
            metricName: metric,
            metricStatus: metricInfo.anomalyHealth
          });
        });
      };

      $scope.renderParams = {
        view : {
          nodes: {
            "default": {
              template: "node",
              events: {
                click: $scope.nodeClickHandler
              }
            }
          }
        },
        layout:{
          type: "Absolute"
        },
        jsPlumb: {
          Anchor: "Continuous",
          Endpoint: "Blank",
          Connector: [ "StateMachine", { cssClass: "connectorClass", hoverClass: "connectorHoverClass" } ],
          PaintStyle: { strokeWidth: 1, stroke: '#32b2e1' },
          HoverPaintStyle: { stroke: "orange" },
          Overlays: [
            [ "Arrow", { fill: "#09098e", width: 10, length: 10, location: 1 } ]
          ]
        },
        lassoFilter: ".controls, .controls *, .miniview, .miniview *",
        dragOptions: {
          filter: ".delete *"
        },
        consumeRightClick: false
      };

    });
  }
)