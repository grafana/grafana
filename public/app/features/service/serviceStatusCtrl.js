define([
    'angular',
    'lodash',
    'app/app',
  ],
  function (angular, _, app) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.filter('formatItemType', function () {
      return function (text) {
        return text.replace('Host', '').replace('Service', '');
      }
    });

    module.controller('ServiceStatusCtrl', function ($scope, $timeout, $q, $templateCache, serviceDepSrv, jsPlumbService) {
      var toolkit = jsPlumbService.getToolkit("serviceToolkit");

      $scope.$on('$destroy', function () {
        toolkit.clear();
      });

      window.ctrl = this;
      $scope.service = {};

      $scope.init = function (scope, element, attrs) {
        toolkit = scope.toolkit;

        serviceDepSrv.readServiceDependency().then(function (response) {
          if (!_.isNull(response.data)) {
            var dependencies = angular.fromJson(_.last(response.data).attributes[0].value);

            _.each(dependencies.nodes, function (node) {
              serviceDepSrv.readServiceStatus(node.id, node.name).then(function (resp) {
                node.status = resp.data.healthStatusType;
              });
            });
            
            // toolkit.clear();
            toolkit.load({ data: dependencies });
          }
        });
      };

      $scope.nodeClickHandler = function (node) {
        $(node.el).addClass("active").siblings().removeClass("active");
        
        var serviceId = node.node.data.id;  // $(node.el).attr("data-jtk-node-id");
        var serviceName = node.node.data.name;
        
        $scope.service = {};
        $scope.metrics = {};
        
        serviceDepSrv.readMetricStatus(serviceId, serviceName).then(function (response) {
          $scope.service = response.data;
        });
      };

      $scope.selectHost = function(index, host) {
        // hack
        $scope.metric = [];
        $scope.$broadcast('load-table');

        $scope.selected = ($scope.selected == index) ? -1 : index;
      };

      $scope.selectHealthItemType = function (host, item) {
        var metrics = $scope.service.hostStatusMap[host].itemStatusMap[item].metricStatusMap;
        var metric = [];

        for (name in metrics) {
          metric.push({
            name: name,
            anomalyHealth: metrics[name].anomalyHealth
          });
        }

        $scope.currentHost = host;
        $scope.currentItem = item;
        $scope.metric = metric;

        $scope.$broadcast('load-table');
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