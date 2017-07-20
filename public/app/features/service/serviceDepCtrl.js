define([
  'angular',
  'lodash',
  'app/core/config',
],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ServiceDepCtrl', function ($scope, $log, jsPlumbService) {
      var ctrl = this;

      // toolkit id
      var toolkitId = "demoToolkit";
      // var toolkit;
      // var surface;

      var toolkit = jsPlumbService.getToolkit("demoToolkit");
      var surface = jsPlumbService.getSurface("demoSurface");

      window.jsps = jsPlumbService;
      window.ctrl = this;

      //
      // scope contains
      // jtk - the toolkit
      // surface - the surface
      //
      // element is the DOM element into which the toolkit was rendered
      //
      this.init = function(scope, element, attrs) {

          toolkit = window.toolkit = scope.toolkit;
          console.log('init');

          toolkit.load({
              data : {
                  "groups":[
                      {"id":"one", "title":"Group 1", "left":100, top:50 },
                      {"id":"two", "title":"Group 2", "left":450, top:250, type:"constrained"  }
                  ],
                  "nodes": [
                      { "id": "window1", "name": "1", "left": 10, "top": 20, group:"one" },
                      { "id": "window2", "name": "2", "left": 140, "top": 50, group:"one" },
                      { "id": "window3", "name": "3", "left": 450, "top": 50 },
                      { "id": "window4", "name": "4", "left": 110, "top": 370 },
                      { "id": "window5", "name": "5", "left": 140, "top": 150, group:"one" },
                      { "id": "window6", "name": "6", "left": 50, "top": 50, group:"two" },
                      { "id": "window7", "name": "7", "left": 50, "top": 450 }
                  ],
                  "edges": [
                      { "source": "window1", "target": "window3" },
                      { "source": "window1", "target": "window4" },
                      { "source": "window3", "target": "window5" },
                      { "source": "window5", "target": "window2" },
                      { "source": "window4", "target": "window6" },
                      { "source": "window6", "target": "window2" }
                  ]
              }
          });

          surface = jsPlumbService.getSurface("demoSurface");

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

          //
          // any operation that caused a data update (and would have caused an autosave), fires a dataUpdated event.
          //
          toolkit.bind("dataUpdated", _updateDataset);
      };

      this.typeExtractor = function (el) {
          return el.getAttribute("jtk-node-type");
      };

      $scope.draggableTypes = [
          {label: "Node", type: "node"},
          {label: "Group", type: "group", group:true }
      ];

      $scope.remove = function (obj) {
          toolkit.removeNode(obj);
      };

      $scope.toggleGroup = function(group) {
          surface.toggleGroup(group);
      };

      this.toolkitParams = {
          groupFactory:function(type, data, callback) {
              data.title = "Group " + (toolkit.getGroupCount() + 1);
              callback(data);
          },
          nodeFactory:function(type, data, callback) {
              data.name = (toolkit.getNodeCount() + 1);
              callback(data);
          }
      };

      this.renderParams = {
          view : {
              nodes: {
                  "default": {
                      template: "node"
                  }
              },
              groups:{
                  "default":{
                      template:"group",
                      endpoint:"Blank",
                      anchor:"Continuous",
                      revert:false,
                      orphan:true,
                      constrain:false
                  },
                  constrained:{
                      parent:"default",
                      constrain:true
                  }
              }
          },
          layout:{
              type:"Absolute"
          },
          jsPlumb: {
              Anchor:"Continuous",
              Endpoint: "Blank",
              Connector: [ "StateMachine", { cssClass: "connectorClass", hoverClass: "connectorHoverClass" } ],
              PaintStyle: { strokeWidth: 1, stroke: '#89bcde' },
              HoverPaintStyle: { stroke: "orange" },
              Overlays: [
                  [ "Arrow", { fill: "#09098e", width: 10, length: 10, location: 1 } ]
              ]
          },
          lassoFilter: ".controls, .controls *, .miniview, .miniview *",
          dragOptions: {
              filter: ".delete *"
          },
          consumeRightClick:false
      };

      // ---------------- update data set -------------------------
      var _syntaxHighlight = function (json) {
          json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return "<pre>" + json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
              var cls = 'number';
              if (/^"/.test(match)) {
                  if (/:$/.test(match)) {
                      cls = 'key';
                  } else {
                      cls = 'string';
                  }
              } else if (/true|false/.test(match)) {
                  cls = 'boolean';
              } else if (/null/.test(match)) {
                  cls = 'null';
              }
              return '<span class="' + cls + '">' + match + '</span>';
          }) + "</pre>";
      };

      var datasetContainer = document.querySelector(".jtk-demo-dataset");
      var _updateDataset = function () {
          datasetContainer.innerHTML = _syntaxHighlight(JSON.stringify(toolkit.exportData(), null, 4));
      };

    });
  }
)