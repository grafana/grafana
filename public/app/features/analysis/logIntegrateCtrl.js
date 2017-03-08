define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('LogIntegrateCtrl', function ($scope, contextSrv) {
      var panelMeta = {
        "collapse": false,
        "editable": false,
        "height": "300px",
        "panels": [
          {
            "title": "原始数据",
            "error": false,
            "span": 12,
            "editable": true,
            "type": "graph",
            "id": 1,
            "datasource": null,
            "renderer": "flot",
            "x-axis": true,
            "y-axis": true,
            "y_formats": [
              "short",
              "short"
            ],
            "grid": {
              "leftLogBase": 1,
              "leftMax": null,
              "rightMax": null,
              "leftMin": null,
              "rightMin": null,
              "rightLogBase": 1,
              "threshold1": null,
              "threshold2": null,
              "threshold1Color": "rgba(216, 200, 27, 0.27)",
              "threshold2Color": "rgba(234, 112, 112, 0.22)"
            },
            "lines": true,
            "fill": 1,
            "linewidth": 2,
            "points": false,
            "pointradius": 5,
            "bars": false,
            "stack": false,
            "percentage": false,
            "legend": {
              "show": true,
              "values": false,
              "min": false,
              "max": false,
              "current": false,
              "total": false,
              "avg": false
            },
            "nullPointMode": "connected",
            "steppedLine": false,
            "tooltip": {
              "value_type": "cumulative",
              "shared": true
            },
            "timeFrom": null,
            "timeShift": null,
            "targets": [],
            "aliasColors": {},
            "seriesOverrides": []
          },
          {
            "title": "原始数据的周期性",
            "error": false,
            "span": 6,
            "editable": true,
            "type": "graph",
            "id": 2,
            "datasource": null,
            "renderer": "flot",
            "x-axis": true,
            "y-axis": true,
            "y_formats": [
              "short",
              "short"
            ],
            "grid": {
              "leftLogBase": 1,
              "leftMax": null,
              "rightMax": null,
              "leftMin": null,
              "rightMin": null,
              "rightLogBase": 1,
              "threshold1": null,
              "threshold2": null,
              "threshold1Color": "rgba(216, 200, 27, 0.27)",
              "threshold2Color": "rgba(234, 112, 112, 0.22)"
            },
            "lines": true,
            "fill": 1,
            "linewidth": 2,
            "points": false,
            "pointradius": 5,
            "bars": false,
            "stack": false,
            "percentage": false,
            "legend": {
              "show": true,
              "values": false,
              "min": false,
              "max": false,
              "current": false,
              "total": false,
              "avg": false
            },
            "nullPointMode": "connected",
            "steppedLine": false,
            "tooltip": {
              "value_type": "cumulative",
              "shared": true
            },
            "timeFrom": null,
            "timeShift": "2d",
            "targets": [],
            "aliasColors": {},
            "seriesOverrides": []
          },
          {
            "title": "负载均衡情况",
            "error": false,
            "span": 6,
            "editable": true,
            "type": "graph",
            "id": 3,
            "datasource": null,
            "renderer": "flot",
            "x-axis": true,
            "y-axis": true,
            "y_formats": [
              "percent",
              "short"
            ],
            "grid": {
              "leftLogBase": 1,
              "leftMax": null,
              "rightMax": null,
              "leftMin": null,
              "rightMin": null,
              "rightLogBase": 1,
              "threshold1": null,
              "threshold2": null,
              "threshold1Color": "rgba(216, 200, 27, 0.27)",
              "threshold2Color": "rgba(234, 112, 112, 0.22)"
            },
            "lines": true,
            "fill": 1,
            "linewidth": 2,
            "points": false,
            "pointradius": 5,
            "bars": false,
            "stack": false,
            "percentage": false,
            "legend": {
              "show": true,
              "values": false,
              "min": false,
              "max": false,
              "current": false,
              "total": false,
              "avg": false
            },
            "nullPointMode": "connected",
            "steppedLine": false,
            "tooltip": {
              "value_type": "cumulative",
              "shared": true
            },
            "timeFrom": null,
            "timeShift": null,
            "targets": [],
            "aliasColors": {},
            "seriesOverrides": []
          },
          {
            "title": "",
            "error": false,
            "span": 12,
            "editable": false,
            "type": "text",
            "id": 5,
            "mode": "html",
            "content": "",
            "height": "1000px",
            "transparent": true
          }
        ],
        "showTitle": false,
        "title": "New row"
      };
      this.init = function (param) {
        panelMeta.panels[0].targets = param.targets;
        panelMeta.panels[1].targets = _.cloneDeep(param.targets);
        _.each(panelMeta.panels[1].targets, function (target) {
          target.metric = target.metric + ".seasonal"
        });
        panelMeta.panels[2].targets = _.cloneDeep(param.targets);
        _.each(panelMeta.panels[2].targets, function (target) {
          target.metric = target.metric + ".LB.percent"
        });
        var service = param.title.split(".")[0] || "*";
        var host = param.targets[0].tags.host;
        var org = contextSrv.user.orgId;
        var system = contextSrv.system;

        panelMeta.panels[3].content = "<iframe src=\"" + contextSrv.elkUrl + "/app/kibana#/discover?_g=(refreshInterval:(display:Off,pause:!f,value:0),time:(from:'" + param.from + "',mode:quick,to:'" + param.to + "'))&_a=(columns:!(_source),index:'1000" + org + "-" + system + "',interval:auto,query:(query_string:(analyze_wildcard:!t,query:'type: " + service + " AND host:" + host + "')),sort:!('@timestamp',desc))\" height=\"1000px\" width=\"100%\"></iframe>"

        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: true, canSave: false},
          dashboard: {
            system: contextSrv.system,
            title: "整合分析",
            id: "123",
            rows: [panelMeta],
            time: {from: param.from, to: param.to}
          }
        }, $scope);
      };
    });
  });
