define([
    'angular',
    'lodash',
    'app/app',
  ],
  function (angular, _, app) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ServiceStatusCtrl', function ($scope, $timeout, $q, serviceDepSrv, jsPlumbService) {
      var toolkit = jsPlumbService.getToolkit("demoToolkit");
      var surface = jsPlumbService.getSurface("demoSurface");
      var service = '';

      $scope.service = {};

      $scope.init = function (scope, element, attrs) {
        toolkit = window.toolkit = scope.toolkit;

        serviceDepSrv.readServiceDependency().then(function (response) {
          if (!_.isNull(response.data)) {
            var dependencies = JSON.parse(angular.fromJson(_.last(response.data).attributes[0].value));
            
            $scope.updateId  = _.last(response.data).id;
            $scope.graphId   = _.last(response.data).attributes[0].id;
            
            _.each(dependencies.nodes, function (node) {
              serviceDepSrv.readServiceStatus(node.id).then(function (resp) {
                node.status = resp.data.healthStatusType;
              });
            });
            
            toolkit.load({ data: dependencies });
          }
        });
      };

      $scope.nodeClickHandler = function (node) {
        $(node.el).addClass("active").siblings().removeClass("active");
        
        service = $(node.el).attr("data-jtk-node-id");
        
        $scope.service.hosts = [];
        // $scope.service.healthItemType = [];
        $scope.service.metrics = [];
        
        serviceDepSrv.readHostStatus(service).then(function (response) {
          var hosts = [];
          var items = [];
          $scope.service.hosts = [];

          if (!_.isNull(response.data)) {
            response = response.data;
            hosts = Object.keys(response.hostStatusMap);

            _.each(hosts, function (host) {
              var hostInfo = response.hostStatusMap[host];
              var healthItemType = [];
              
              serviceDepSrv.readMetricStatus(service, host).then(function (resp) {
                if (!_.isNull(resp.data)) {
                  resp = resp.data;
                  items = Object.keys(resp.hostStatusMap[host].itemStatusMap);
                  $scope.itemStatusMap = resp.hostStatusMap[host].itemStatusMap;
                  // $scope.service.healthItemType = [];

                  _.each(items, function (item) {
                    var itemInfo = resp.hostStatusMap[host].itemStatusMap[item];
                    // $scope.service.healthItemType.push({
                    healthItemType.push({
                      itemType: itemInfo.type,
                      name: itemInfo.type.replace('Host', '').replace('Service', ''),
                      itemTypeStatus: itemInfo.healthStatusType
                    });
                  });
                }
              });

              $scope.service.hosts.push({
                hostName: hostInfo.hostName,
                hostStatus: hostInfo.healthStatusType,
                itemType: healthItemType
              });
            });
          }
        });
      };

      $scope.selectHost = function(index, host) {
        $scope.selected = ($scope.selected == index) ? -1 : index;
      };

      $scope.selectHealthItemType = function (itemType) {
        var metrics = Object.keys($scope.itemStatusMap[itemType].metricStatusMap || {});
        $scope.service.metrics = [];
        
        _.each(metrics, function (metric) {
          var metricInfo = $scope.itemStatusMap[itemType].metricStatusMap[metric];
          $scope.service.metrics.push({
            metricName: metric,
            metricStatus: metricInfo.anomalyHealth
          });
        });

        // $("#metricStatus").bootstrapTable({
        //   data: $scope.service.metrics
        // });
        $("#metricStatus").bootstrapTable('load', $scope.service.metrics);
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