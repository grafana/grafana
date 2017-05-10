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
                  "hide": true
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
            }
          ],
          "showTitle": false,
          "title": ""
        }
      ];

      $scope.logCluster = function() {
        $scope.clustering = true;
        $scope.dashboard.rows[0].panels[1].targets[0].hide = false;
        $rootScope.$broadcast('refresh');
      };

      $scope.reQuery = function () {
        $scope.dashboard.rows[0].panels[0].targets[0].query = $scope.query;
        $scope.dashboard.rows[0].panels[1].targets[0].query = $scope.query;
        $scope.dashboard.rows[0].panels[1].targets[0].hide = true;
        $scope.clustering = false;
        $rootScope.$broadcast('refresh');
      };

      $scope.isShowKnows = function(type) {
        $scope.showKnows = type;
      }

      $scope.init = function () {
        $scope.showKnows = false;
        $scope.query = "*";
        $scope.clustering = false;
        panelMetas[0].panels[0].targets[0].query = $scope.query;
        panelMetas[0].panels[1].targets[0].query = $scope.query;
        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: false, canSave: false},
          dashboard: {
            system: contextSrv.system,
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
