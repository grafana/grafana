define([
    'angular',
    'lodash',
    'highlight',
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('LogIntegrateCtrl', function ($scope, $rootScope, contextSrv, integrateSrv) {
      var option = {
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
          "legend": {
            "show": true,
            "values": false,
            "min": false,
            "max": false,
            "current": false,
            "total": false,
            "avg": false
          },
          "tooltip": {
            "value_type": "cumulative",
            "shared": true
          }
      };
      var panelMetas = [
        {
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
              "grid": option.grid,
              "lines": true,
              "fill": 1,
              "linewidth": 2,
              "points": false,
              "pointradius": 5,
              "bars": false,
              "stack": false,
              "percentage": false,
              "legend": option.legend,
              "nullPointMode": "connected",
              "steppedLine": false,
              "tooltip": option.tooltip,
              "timeFrom": null,
              "timeShift": null,
              "targets": [],
              "aliasColors": {},
              "seriesOverrides": []
            }
          ],
          "showTitle": true,
          "title": "原始数据"
        },
        {
          "collapse": true,
          "editable": false,
          "height": "300px",
          "panels": [
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
              "grid": option.grid,
              "lines": true,
              "fill": 1,
              "linewidth": 2,
              "points": false,
              "pointradius": 5,
              "bars": false,
              "stack": false,
              "percentage": false,
              "legend": option.legend,
              "nullPointMode": "connected",
              "steppedLine": false,
              "tooltip": option.tooltip,
              "timeFrom": null,
              "timeShift": null,
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
              "grid": option.grid,
              "lines": true,
              "fill": 1,
              "linewidth": 2,
              "points": false,
              "pointradius": 5,
              "bars": false,
              "stack": false,
              "percentage": false,
              "legend": option.legend,
              "nullPointMode": "connected",
              "steppedLine": false,
              "tooltip": option.tooltip,
              "timeFrom": null,
              "timeShift": null,
              "targets": [],
              "aliasColors": {},
              "seriesOverrides": []
            }
          ],
          "showTitle": true,
          "title": "关键性能指标"
        },
        {
          "collapse": false,
          "editable": false,
          "height": "300px",
          "panels": [
            {
              "columns": [
                {
                  "text": "@timestamp",
                  "value": "@timestamp"
                },
                {
                  "text": "host",
                  "value": "host"
                },
                {
                  "text": "_type",
                  "value": "_type"
                },
                {
                  "text": "message",
                  "value": "message"
                }
              ],
              "datasource": "elk",
              "editable": true,
              "error": false,
              "fontSize": "100%",
              "height": "500",
              "helpInfo": {
                "context": "",
                "info": false,
                "title": ""
              },
              "hideTimeOverride": false,
              "id": 1,
              "isNew": true,
              "links": [],
              "pageSize": null,
              "scroll": false,
              "showHeader": true,
              "sort": {
                "col": 0,
                "desc": true
              },
              "span": 12,
              "styles": [
                {
                  "dateFormat": "YYYY-MM-DD HH:mm:ss",
                  "pattern": "@timestamp",
                  "type": "date"
                },
                {
                  "colorMode": null,
                  "colors": [
                    "rgba(245, 54, 54, 0.9)",
                    "rgba(237, 129, 40, 0.89)",
                    "rgba(50, 172, 45, 0.97)"
                  ],
                  "decimals": 2,
                  "pattern": "/.*/",
                  "thresholds": [],
                  "type": "number",
                  "unit": "short"
                }
              ],
              "targets": [
                {
                  "aggregator": "sum",
                  "bucketAggs": [],
                  "downsampleAggregator": "avg",
                  "dsType": "elasticsearch",
                  "errors": {},
                  "metrics": [
                    {
                      "field": "select field",
                      "id": "1",
                      "meta": {},
                      "settings": {},
                      "type": "raw_document"
                    }
                  ],
                  "refId": "A",
                  "timeField": "@timestamp"
                }
              ],
              "tab": 1,
              "title": "日志查询",
              "transform": "json",
              "transparent": false,
              "type": "table"
            },
            {
              "columns": [
                {
                  "text": "count",
                  "value": "count"
                },
                {
                  "text": "message",
                  "value": "message"
                }
              ],
              "datasource": "elk",
              "editable": true,
              "error": false,
              "fontSize": "120%",
              "height": "500",
              "helpInfo": {
                "context": "",
                "info": false,
                "title": ""
              },
              "hideTimeOverride": false,
              "id": Math.random(),
              "isNew": true,
              "links": [],
              "pageSize": null,
              "scroll": false,
              "showHeader": true,
              "sort": {
                "col": 0,
                "desc": true
              },
              "span": 12,
              "styles": [
                {
                  "dateFormat": "YYYY-MM-DD HH:mm:ss",
                  "pattern": "@timestamp",
                  "type": "date"
                },
                {
                  "colorMode": null,
                  "colors": [
                    "rgba(245, 54, 54, 0.9)",
                    "rgba(237, 129, 40, 0.89)",
                    "rgba(50, 172, 45, 0.97)"
                  ],
                  "decimals": 0,
                  "pattern": "/.*/",
                  "thresholds": [],
                  "type": "number",
                  "unit": "short"
                }
              ],
              "targets": [
                {
                  "aggregator": "sum",
                  "bucketAggs": [],
                  "downsampleAggregator": "avg",
                  "dsType": "elasticsearch",
                  "errors": {},
                  "metrics": [
                    {
                      "field": "select field",
                      "id": Math.random(),
                      "meta": {},
                      "settings": {},
                      "type": "raw_document"
                    }
                  ],
                  "refId": "A",
                  "timeField": "@timestamp",
                }
              ],
              "title": "聚合数据",
              "transform": "json",
              "transparent": false,
              "type": "table",
              "tab": 2,
              "scopedVars": {
                "logCluster": true
              }
            },
            {
              "columns": [
                {
                  "text": "count",
                  "value": "count"
                },
                {
                  "text": "change",
                  "value": "change"
                },
                {
                  "text": "message",
                  "value": "message"
                }
              ],
              "datasource": "elk",
              "editable": true,
              "error": false,
              "fontSize": "100%",
              "helpInfo": {
                "context": "",
                "info": false,
                "title": ""
              },
              "id": Math.random(),
              "isNew": true,
              "links": [],
              "pageSize": null,
              "scroll": false,
              "showHeader": true,
              "sort": {
                "col": 0,
                "desc": true
              },
              "span": 12,
              "styles": [
                {
                  "dateFormat": "YYYY-MM-DD HH:mm:ss",
                  "pattern": "Time",
                  "type": "date"
                }
              ],
              "targets": [
                {
                  "aggregator": "sum",
                  "bucketAggs": [],
                  "downsampleAggregator": "avg",
                  "dsType": "elasticsearch",
                  "errors": {},
                  "metrics": [
                    {
                      "field": "select field",
                      "id": Math.random(),
                      "meta": {},
                      "settings": {},
                      "type": "raw_document"
                    }
                  ],
                  "query": "",
                  "refId": "A",
                  "timeField": "@timestamp",
                },
                {
                  "bucketAggs": [],
                  "dsType": "elasticsearch",
                  "metrics": [
                    {
                      "field": "select field",
                      "id": Math.random(),
                      "meta": {},
                      "settings": {},
                      "type": "raw_document"
                    }
                  ],
                  "query": "",
                  "refId": "B",
                  "timeField": "@timestamp",
                  "timeShift": "-1d",
                }
              ],
              "tab": 3,
              "title": "日志对比",
              "transform": "json",
              "type": "table",
              "scopedVars": {
                "logCompare": true
              }
            }
          ],
          "showTitle": false,
          "title": ""
        }
      ];

      $scope.reQuery = function () {
        var panels = $scope.dashboard.rows[2].panels;
        panels[0].targets[0].query = $scope.query;

        panels[1].targets[0].query = $scope.query;

        panels[2].targets[0].query = $scope.query;
        panels[2].targets[1].query = $scope.query;

        $rootScope.$broadcast('refresh');
      };

      $scope.showInputModal = function() {
        var newScope = $scope.$new();
        newScope.logCompare = $scope.logCompare;
        newScope.shift = "-1d";
        $scope.appEvent('show-modal', {
          src: 'public/app/features/logs/partials/input_time_shift.html',
          modalClass: 'modal-no-header confirm-modal',
          scope: newScope
        });
      };
      $scope.logCompare = function(timeShift) {
        $scope.dashboard.rows[2].panels[2].targets[1].timeShift = timeShift;
        $rootScope.$broadcast('refresh');
      };

      $scope.currentFilter = "无";
      $scope.logFilter = function (rule) {
        $scope.dashboard.rows[2].panels[2].scopedVars.logFilter = rule;
        $rootScope.$broadcast('refresh');
        $scope.currentFilter = rule + "日志";
      };

      $scope.init = function (param) {
        param.targets = param.targets.filter(function (metrics) {
          return _.excludeMetricSuffix(metrics.metric);
        });
        panelMetas[0].panels[0].targets = param.targets;
        panelMetas[0].panels[0].title = param.title;
        panelMetas[1].panels[0].targets = _.cloneDeep(param.targets);
        _.each(panelMetas[1].panels[0].targets, function (target) {
          target.metric = target.metric + ".seasonal";
        });
        panelMetas[1].panels[1].targets = _.cloneDeep(param.targets);
        _.each(panelMetas[1].panels[1].targets, function (target) {
          target.metric = target.metric + ".LB.percent";
        });
        var type = metricPrefix2Type(param.targets[0].metric.split(".")[0]);
        var host = param.targets[0].tags.host === "*" ? "*" : param.targets[0].tags.host;  // *  or 'centos24'

        $scope.query = "type:"+type+" AND host:"+host;
        panelMetas[2].panels[0].targets[0].query = $scope.query;
        panelMetas[2].panels[1].targets[0].query = $scope.query;
        panelMetas[2].panels[2].targets[0].query = $scope.query;
        panelMetas[2].panels[2].targets[1].query = $scope.query;

        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: false, canSave: false},
          dashboard: {
            title: "整合分析",
            id: "123",
            rows: panelMetas,
            time: {from: param.from, to: param.to},
            manualAnnotation: integrateSrv.options.annotations
          }
        }, $scope);
      };

      function metricPrefix2Type(prefix) {
        if (_.isNull(prefix)) {
          return "*";
        }
        if (/(iostat|cpu|df|net|proc)/.test(prefix)) {
          return "system";
        }else if (/(ssh_failed)/.test(prefix)) {
          return "security";
        }
        return prefix;
      }
      $scope.init(integrateSrv.options);
    });
  });
