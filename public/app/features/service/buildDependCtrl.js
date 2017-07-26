define([
    'angular',
    'lodash',
    'app/app',
  ],
  function (angular, _, app) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('BuildDependCtrl', function ($scope, $timeout, alertSrv, serviceDepSrv, jsPlumbService) {
      var toolkit = jsPlumbService.getToolkit("serviceDepToolkit");
      window.ctrl = this;

      $scope.$on('$destroy', function () {
        toolkit.clear();
      });

      // load palette data
      $scope.draggableTypes = [];
      serviceDepSrv.readInstalledService().then(function (response) {
        var services = response.data;
        var serviceIconMap = _.serviceIconMap();

        _.each(services, function (service) {
          $scope.draggableTypes.push({
            id   : service.id,
            key  : service.name,
            label: service.name,
            type : "node",
            icon : serviceIconMap[service.name]
          });
        });
      });

      // update data set
      var _updateDataset = function () {
        ctrl.exportData = toolkit.exportData();
      };

      $scope.init = function(scope, element) {
        toolkit = scope.toolkit;
        var surface = jsPlumbService.getSurface("serviceDepSurface");

        serviceDepSrv.readServiceDependency().then(function (response) {
          var dependencies = {};
          if (!_.isNull(response.data)) {
            dependencies = angular.fromJson(_.last(response.data).attributes[0].value);

            $scope.updateId  = _.last(response.data).id;
            $scope.graphId   = _.last(response.data).attributes[0].id;
          }

          toolkit.load({ data: dependencies });
        });

        // any operation that caused a data update (and would have caused an autosave), fires a dataUpdated event.
        toolkit.bind("dataUpdated", _updateDataset);

        var controls = element[0].querySelector(".controls");
        // listener for mode change on renderer.
        surface.bind("modeChanged", function (mode) {
          jsPlumb.removeClass(controls.querySelectorAll("[mode]"), "selected-mode");
          jsPlumb.addClass(controls.querySelectorAll("[mode='" + mode + "']"), "selected-mode");
        });

        // pan mode/select mode
        jsPlumb.on(controls, "tap", "[mode]", function () {
          surface.setMode(this.getAttribute("mode"));
        });

        // on home button click, zoom content to fit.
        jsPlumb.on(controls, "tap", "[reset]", function () {
          toolkit.clearSelection();
          surface.zoomToFit();
        });

        // refresh palette data
        $timeout(function() {
          $scope.$broadcast("draggableNodeLoaded");
        }, 500);
      };

      $scope.renderParams = {
        view : {
          nodes: {
            "default": {
              template: "node"
            }
          }
        },
        layout:{
          type:"Absolute"
        },
        jsPlumb: {
          Anchor: "Continuous",
          Endpoint: "Blank",
          Connector: ["StateMachine", { cssClass: "connectorClass", hoverClass: "connectorHoverClass" }],
          PaintStyle: { strokeWidth: 1, stroke: '#32b2e1' },
          HoverPaintStyle: { stroke: "orange" },
          Overlays: [
            ["Arrow", { fill: "#09098e", width: 10, length: 10, location: 1 }]
          ]
        },
        lassoFilter: ".controls, .controls *, .miniview, .miniview *",
        dragOptions: {
          filter: ".delete *"
        },
        consumeRightClick: false
      };

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

      $scope.remove = function (obj) {
        toolkit.removeNode(obj);
      };

      $scope.typeExtractor = function (el) {
        return el.getAttribute("jtk-node-type");
      };

      $scope.dataGenerator = function (type, dragElement) {
        var $dragElement = $(dragElement);
        var serviceIconMap = _.serviceIconMap();
        var serviceName = $dragElement.attr('data-node-key');
        return {
          name: serviceName,
          id  : $dragElement.attr('data-node-id'),
          icon: serviceIconMap[serviceName]
        };
      }

    });
  }
);