define([
  'angular',
  'lodash',
  'app/core/config',
],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ServiceDepCtrl', function ($scope, $log, jsPlumbService, serviceDepSrv, alertSrv, $timeout) {
      var ctrl = this;

      // toolkit id
      var toolkitId = "demoToolkit";

      var toolkit = jsPlumbService.getToolkit("demoToolkit");
      var surface = jsPlumbService.getSurface("demoSurface");

      window.jsps = jsPlumbService;
      window.ctrl = this;

      $scope.remove = function (obj) {
        toolkit.removeNode(obj);
      };

      //
      // scope contains
      // jtk - the toolkit
      // surface - the surface
      //
      // element is the DOM element into which the toolkit was rendered
      //
      this.init = function(scope, element, attrs) {
        toolkit = window.toolkit = scope.toolkit;
        surface = jsPlumbService.getSurface("demoSurface");

        var data = {};
        toolkit.load({ data : data });

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

        // any operation that caused a data update (and would have caused an autosave), fires a dataUpdated event.
        toolkit.bind("dataUpdated", _updateDataset);
        
        // refresh palette data
        $timeout(function() {
          $scope.$broadcast("draggableNodeLoaded");
        }, 500);
      };

      this.typeExtractor = function (el) {
        return el.getAttribute("jtk-node-type");
      };

      this.dataGenerator = function (type, dragElement, dropInfo) {
        var $dragElement = $(dragElement);
        var serviceIconMap = _.serviceIconMap();
        return {
          name: $dragElement.text(),
          id  : $dragElement.attr('data-node-id'),
          icon: serviceIconMap[$dragElement.attr('data-node-id')]
        };
      }

      this.renderParams = {
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

      // update data set
      var _updateDataset = function () {
        ctrl.exportData = toolkit.exportData();
      };

    });
  }
)