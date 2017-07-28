define([
    'angular',
    'lodash'
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('LogsCtrl', function ($scope, contextSrv, $rootScope) {
      var panelMetas = [
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
                  "dateFormat": "YYYY-MM-DD HH:mm:ss,sss",
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
                  "timeField": "@timestamp",
                  "size": 500
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
                  "dateFormat": "YYYY-MM-DD HH:mm:ss,sss",
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
                  "size": 500
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
                  "dateFormat": "YYYY-MM-DD HH:mm:ss,sss",
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
                  "size": 500
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
                  "size": 500
                }
              ],
              "tab": 3,
              "title": "日志对比",
              "transform": "json",
              "type": "table",
              "scopedVars": {
                "logCompare": true
              }
            },
            {
              "aliasColors": {},
              "bars": true,
              "datasource": "elk",
              "editable": true,
              "error": false,
              "fill": 1,
              "grid": {
                "leftLogBase": 1,
                "leftMax": null,
                "leftMin": null,
                "rightLogBase": 1,
                "rightMax": null,
                "rightMin": null,
                "threshold1": null,
                "threshold1Color": "rgba(216, 200, 27, 0.27)",
                "threshold2": null,
                "threshold2Color": "rgba(234, 112, 112, 0.22)"
              },
              "id": 3,
              "legend": {
                "avg": false,
                "current": false,
                "max": false,
                "min": false,
                "show": false,
                "total": false,
                "values": false
              },
              "lines": false,
              "linewidth": 2,
              "nullPointMode": "connected",
              "percentage": false,
              "pointradius": 5,
              "points": false,
              "renderer": "flot",
              "seriesOverrides": [],
              "span": 12,
              "stack": false,
              "steppedLine": false,
              "targets": [
                {
                  "aggregator": "sum",
                  "bucketAggs": [
                    {
                      "field": "@timestamp",
                      "id": "2",
                      "settings": {
                        "interval": "auto",
                        "min_doc_count": 0
                      },
                      "type": "date_histogram"
                    }
                  ],
                  "downsampleAggregator": "avg",
                  "dsType": "elasticsearch",
                  "errors": {},
                  "metric": "internal.alert.state",
                  "metrics": [
                    {
                      "field": "select field",
                      "id": "1",
                      "type": "count"
                    }
                  ],
                  "query": "*",
                  "refId": "A",
                  "timeField": "@timestamp"
                }
              ],
              "timeFrom": null,
              "timeShift": null,
              "title": "日志总数",
              "tooltip": {
                "shared": true,
                "value_type": "cumulative"
              },
              "transparent": true,
              "type": "graph",
              "x-axis": true,
              "y-axis": true,
              "y_formats": [
                "short",
                "short"
              ],
              "links": [],
              "helpInfo": {
                "info": false,
                "title": "",
                "context": ""
              }
            }
          ],
          "showTitle": false,
          "title": ""
        }
      ];

      $scope.logCompare = function(timeShift) {
        $scope.dashboard.rows[0].panels[2].targets[1].timeShift = timeShift;
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

      $scope.reQuery = function () {
        var panels = $scope.dashboard.rows[0].panels;
        //log
        panels[0].targets[0].query = $scope.query;
        //clustering
        panels[1].targets[0].query = $scope.query;
        //compareing
        panels[2].targets[0].query = $scope.query;
        panels[2].targets[1].query = $scope.query;
        //count
        panels[3].targets[0].query = $scope.query;

        $rootScope.$broadcast('refresh');
      };

      $scope.isShowKnows = function(type) {
        $scope.showKnows = type;
      };

      $scope.hideGuide = function() {
        $scope.showSearchGuide = false;
      };

      $scope.getLogSize = function(size) {
        var panels = $scope.dashboard.rows[0].panels;
        var target = $scope.dashboard.rows[0].panels[0].targets[0];
        if (panels[0].targets[0].size == size) {
          return;
        };
        panels[0].targets[0].size = size;
        panels[1].targets[0].size = size;
        panels[2].targets[0].size = size;
        panels[2].targets[1].size = size;
        $rootScope.$broadcast('refresh');
      };

      $scope.init = function () {
        $scope.showKnows = false;
        $scope.query = "*";
        $scope.size = 500;
        //log table
        panelMetas[0].panels[0].targets[0].query = $scope.query;
        //clustering
        panelMetas[0].panels[1].targets[0].query = $scope.query;
        //comparing
        panelMetas[0].panels[2].targets[0].query = $scope.query;
        panelMetas[0].panels[2].targets[1].query = $scope.query;
        //graph
        panelMetas[0].panels[3].targets[0].query = $scope.query;
        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: false, canSave: false},
          dashboard: {
            title: "整合分析",
            id: "123",
            rows: panelMetas,
            time: {from: "now-6h", to: "now"}
          }
        }, $scope);
      };
      $scope.init();
    });
  });
