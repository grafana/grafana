define([
  'angular',
  'lodash',
  'app/core/config',
],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SystemsummaryCtrl', function ($scope, $location, backendSrv, contextSrv, datasourceSrv, alertMgrSrv, healthSrv, $timeout) {
      $scope.getUrl = function(url) {
        return config.appSubUrl + url;
      };

      var panelMeta = {
        "collapse": false,
        "editable": false,
        "height": "260px",
        "panels": [
          {
            "columns": [
              {
                "text": "Current",
                "value": "current"
              }
            ],
            "sort": {
              "col": 1,
              "desc": true
            },
            "styles": [
              {
                "dateFormat": "YYYY-MM-DD HH:mm:ss",
                "pattern": "Time",
                "type": "date"
              },
              {
                "colorMode": "cell",
                "colors": [
                  "rgba(115, 180, 140, 0.76)",
                  "rgba(237, 129, 40, 0.52)",
                  "rgba(246, 0, 0, 0.54)"
                ],
                "decimals": 0,
                "pattern": "/.*/",
                "thresholds": [
                  "0",
                  "1",
                  "2"
                ],
                "type": "number",
                "unit": "short"
              }
            ],
            "transform": "timeseries_aggregations",
            "aliasColors": {
              "test_health": "#EAB839"
            },
            "bars": false,
            "datasource": null,
            "editable": true,
            "error": false,
            "fill": 0,
            "id": 2,
            "lines": true,
            "linewidth": 2,
            "nullPointMode": "connected",
            "percentage": false,
            "renderer": "flot",
            "seriesOverrides": [],
            "span": 12,
            "stack": false,
            "steppedLine": false,
            "targets": [{
              "aggregator": "",
              "currentTagKey": "",
              "currentTagValue": "",
              "downsampleAggregator": "avg",
              "downsampleInterval": "5m",
              "errors": {},
              "hide": false,
              "isCounter": false,
              "metric": "",
              "shouldComputeRate": false,
            }],
            "grid": {
              "threshold1": "",
              "threshold1Color": "rgba(216, 200, 27, 0.27)",
              "threshold2": "",
              "threshold2Color": "rgba(234, 112, 112, 0.22)",
              "thresholdLine": true
            },
            "tooltip": {
              "shared": true,
              "value_type": "cumulative"
            },
            "type": "graph",
            "x-axis": true,
            "y-axis": true,
            "y_formats": [
              "short",
              "short"
            ],
            "transparent": true,
            "legend": true,
           "hideTimeOverride": true,
          }
        ],
        "showTitle": false,
        "title": "New row"
      };

      var panelRow = [];

      $scope.panleJson = [
        { fullwidth: false, header: '报警情况', title: '历史报警状态', status: { success: ['', ''], warn: ['警告', 0], danger: ['严重', 0] }, tip: '2:critical，1:warning,0:normal', href: $scope.getUrl('/alerts/status') },
        { fullwidth: false, header: '智能检测异常指标', title: '历史异常指标概览', status: { success: ['指标数量', 0], warn: ['异常指标', 0], danger: ['严重', 0] }, href: $scope.getUrl('/anomaly')},
        { fullwidth: false, header: '服务状态', title: '历史服务状态', status: { success: ['正常节点', 0], warn: ['异常节点', 0], danger: ['严重', 0] }, href: $scope.getUrl('/service')},
        { fullwidth: false, header: '机器连接状态', title: '历史机器连接状态', status: { success: ['正常机器', 0], warn: ['异常机器', 0], danger: ['尚未工作', 0] }, href: $scope.getUrl('/summary') },
        { fullwidth: true, header: '各线程TopN使用情况', title: '', panels: [{ title: '各线程CPU占用情况(百分比)TopN' }, { title: '各线程内存占用情况(百分比)TopN' },] },
        { fullwidth: true, header: '健康指数趋势', title: '历史健康指数趋势' },
        { fullwidth: true, header: '智能分析预测', title: '', panels: [{ title: '磁盘剩余空间', tip: '预计未来1天后，磁盘剩余空间约为' }, { title: 'CPU使用情况(百分比)', tip: '预计未来1天后，cpu使用情况约为' }, { title: '内存使用情况', tip: '预计未来1天后，内存使用约为' },] },
      ];

      $scope.init = function () {
        if (contextSrv.user.systemId == 0 && contextSrv.user.orgId) {
          $location.url("/systems");
          contextSrv.sidmenu = false;
          return;
        }
        $scope.datasource = null;

        $scope.initDashboard({
          meta: { canStar: false, canShare: false, canEdit: false, canSave: false },
          dashboard: {
            title: "总览",
            id: "name",
            rows: $scope.initPanelRow(),
            time: { from: "now-7d", to: "now" }
          }
        }, $scope);

        $timeout(function() {
          $scope.getAlertStatus();
          $scope.getServices();
          $scope.getHostSummary();
          $scope.getHealth();
          $scope.getPrediction($scope.dashboard.rows[6].panels);
        });
      };

      $scope.initPanelRow = function () {
        _.each($scope.panleJson, function (panel, index) {
          var row = $scope.setPanelTitle(_.cloneDeep(panelMeta), panel.title);
          if (panel.title === '') {
            for (var i = 0; i < $scope.panleJson[index].panels.length - 1; i++) {
              row.panels.push(_.cloneDeep(panelMeta.panels[0]));
            }
            $scope.setPanelMeta(row.panels, panel.panels);
          }
          if (index < 4) {
            row.panels[0].legend = { "alignAsTable": true, "show": true, "rightSide": true, };
          }
          panelRow.push(row);
        });
        var alertRow = panelRow[0],
            anomalyRow = panelRow[1],
            serviceRow = panelRow[2],
            hostRow = panelRow[3],
            topNRow = panelRow[4],
            healthRow = panelRow[5],
            predictionRow = panelRow[6];

        anomalyRow.panels[0].legend.show = false;
        serviceRow.panels[0].type = 'table';
        serviceRow.panels[0].timeFrom = '5m';

        $scope.initAlertStatus(alertRow.panels[0]);
        $scope.initAnomalyStatus(anomalyRow.panels[0]);
        $scope.initHostSummary(hostRow.panels[0]);
        $scope.initTopN(topNRow.panels);
        $scope.initHealth(healthRow.panels[0]);
        $scope.initPrediction(predictionRow.panels);
        return panelRow;
      };

      $scope.setPanelTitle = function (rows, title) {
        rows.panels[0].title = title;
        return rows;
      };

      $scope.setPanelMeta = function (panels, panelCon) {
        for (var i in panels) {
          panels[i].span = 12 / panels.length;
          panels[i].id = i + 1;
          panels[i].title = panelCon[i].title;
        }
      }

      $scope.initAlertStatus = function (panel) {
        var targets = panel.targets[0];
        panel.lines = false;
        panel.bars = true;
        panel.stack = true;
        panel.aliasColors = {
          "critical": "#E24D42",
          "warning": "#F9934E"
        };
        targets.metric = 'internal.alert.num';
        targets.tags = { 'level': '*' };
        targets.aggregator = 'sum';
        targets.downsampleInterval = '5h';
        targets.downsampleAggregator = "p99",
        targets.alias = "$tag_level";
        panel.grid.leftMin = 0;
        panel.grid.thresholdLine = false;
        panel.pointradius = 1;
      };

      $scope.getAlertStatus = function () {
        alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
          if (response.data.length) {
            for (var i = 0; i < response.data.length; i++) {
              var alertDetail = response.data[i];
              if (alertDetail.status.level === "CRITICAL") {
                $scope.panleJson[0].status.danger[1]++;
              } else {
                $scope.panleJson[0].status.warn[1]++;
              }
            }
          } else {
            $scope.panleJson[0].status.success[1] = '系统正常';
          }
        });
      };

      $scope.initAnomalyStatus = function (panel) {
        var targets = panel.targets[0];
        panel.bars = true;
        panel.lines = false;

        targets.metric = 'internal.anomaly.num';
        targets.downsampleInterval = '5h';
        targets.aggregator = 'sum';
        targets.downsampleAggregator = 'avg';
      };

      $scope.getServices = function () {
        $scope.dashboard.rows[2].panels[0].targets = [];

        $scope.serviceList = [];
        _.each(Object.keys(_.allServies()), function (key) {
          var queries = [{
            "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + key + ".state",
            "aggregator": "sum",
            "downsample": "10m-sum",
          }];

          datasourceSrv.getServiceStatus(queries, 'now-10m').then(function(response) {
            if(response.status > 0) {
              $scope.panleJson[2].status.warn[1]++;
            } else {
              $scope.panleJson[2].status.success[1]++;
            }
            var targets = _.cloneDeep(panelMeta.panels[0].targets[0]);
            targets.metric = key + '.state';
            targets.aggregator = queries[0].aggregator;
            targets.downsample = queries[0].downsample;
            targets.downsampleAggregator = 'sum';
            $scope.dashboard.rows[2].panels[0].targets.push(targets);
          });
        });
      };

      $scope.initHostSummary = function (panel) {
        panel.type = 'table';
        panel.timeFrom = '5m';
        var targets = panel.targets[0];
        targets.metric = 'collector.state';
        targets.alias = "$tag_host";
        targets.tags = { 'host': '*' };
        targets.aggregator = "sum";
        targets.downsample = "1m-sum";
        targets.downsampleAggregator = 'sum';
      }

      $scope.getHostSummary = function () {
        $scope.summaryList = [];
        backendSrv.alertD({
          method: "get",
          url: "/summary",
          params: { metrics: "collector.summary" },
          headers: { 'Content-Type': 'text/plain' },
        }).then(function (response) {
          $scope.summaryList = response.data;
        }).then(function () {
          _.each($scope.summaryList, function (metric) {
            var queries = [{
              "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + ".collector.state",
              "aggregator": "sum",
              "downsample": "1m-sum",
              "tags": { "host": metric.tag.host }
            }];

            datasourceSrv.getServiceStatus(queries, 'now-1m').then(function(response) {
              if(response.status > 0) {
                $scope.panleJson[3].status.warn[1]++;
              } else {
                $scope.panleJson[3].status.success[1]++;
              }
            },function(err) {
              $scope.panleJson[3].status.danger[1]++;
            });

          });
        })
      };

      $scope.initHealth = function (panel) {
        panel.targets[0].metric = 'internal.system.health';
        panel.targets[0].aggregator = 'sum';
        panel.targets[0].downsampleInterval = '5m';
      }

      $scope.getHealth = function () {
        healthSrv.load().then(function (data) {
          $scope.applicationHealth = Math.floor(data.health);
          $scope.leveal = _.getLeveal($scope.applicationHealth);
          $scope.summary = data;
          if (data.metricHostClusters.length && data.metricHostNotClustered.elements.length) {
            $scope.panleJson[1].status.success[1] = data.numMetrics;
            $scope.panleJson[1].status.warn[1] = data.numAnomalyMetrics;
          } else {
            $scope.panleJson[1].status.success[0] = '';
            $scope.panleJson[1].status.success[1] = '系统正常';
          }
        });
      };

      $scope.initPrediction = function (panels) {
        var prediction = [['df.bytes.free', 'df.bytes.free.prediction'], ['cpu.usr', 'cpu.usr.prediction'], ['proc.meminfo.active', 'proc.meminfo.active.prediction']];
        _.each(panels, function (panel, index) {
          panel.targets = [];
          for (var i in prediction[index]) {
            var targets = _.cloneDeep(panelMeta.panels[0].targets[0]);
            targets.metric = prediction[index][i];
            targets.aggregator = 'avg';
            targets.downsampleInterval = '30m';
            targets.downsampleAggregator = 'avg';
            panel.targets.push(targets);
          };
          panel.seriesOverrides = [{ "alias": prediction[index][1], "color": "#DEDAF7", "zindex": -2 }];
          panel.y_formats = ['bytes', 'bytes'];
          panel.timeForward = "1d";
          panel.legend = {};
          panel.legend.show = false;
        });
        panels[1].y_formats = ['percent', 'percent'];
      };

      $scope.getPrediction = function (panels) {
        var prediction = [['df.bytes.free', 'df.bytes.free.prediction'], ['cpu.usr', 'cpu.usr.prediction'], ['proc.meminfo.active', 'proc.meminfo.active.prediction']];
        _.each(prediction, function (item, index) {
          var queries = [{
            "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + item[1],
            "downsample": "1d-avg",
            "aggregator": "avg",
          }];

          datasourceSrv.getServiceStatus(queries, 'now', 'now+1d').then(function(response) {
            var data = response.status;
            if (item[1] === 'cpu.usr.prediction') {
              data = data.toFixed(2) + '%';
            } else {
              data = (data / Math.pow(1024, 3)).toFixed(2) + 'GB';
            }
            $scope.panleJson[6].panels[index].tip += data;
          },function(err) {
            $scope.panleJson[6].panels[index].tip = '暂无预测信息';
          });
        });

      };

      $scope.initTopN = function (panels) {
        var cpuTopN = panels[0];
        var memoryTopN = panels[1];
        _.each(panels, function(panel) {
          panel.type = 'table';
          panel.timeFrom = '2m';
          panel.columns = [
            {
              "text": "Max",
              "value": "max"
            },
            {
              "text": "Current",
              "value": "current"
            },
          ];
          panel.styles = [
            {
              "colorMode": null,
              "colors": [
                "rgba(245, 54, 54, 0.9)",
                "rgba(237, 129, 40, 0.89)",
                "rgba(50, 172, 45, 0.97)"
              ],
              "dateFormat": "YYYY-MM-DD HH:mm:ss",
              "decimals": 0,
              "pattern": "Max",
              "thresholds": [
                ""
              ],
              "type": "number",
              "unit": "percent"
            },
            {
              "colorMode": "cell",
              "colors": [
                "rgba(115, 180, 140, 0.76)",
                "rgba(237, 129, 40, 0.52)",
                "rgba(246, 0, 0, 0.54)"
              ],
              "decimals": 0,
              "pattern": "Current",
              "thresholds": [
                "0",
                "30",
                "70"
              ],
              "type": "number",
              "unit": "percent"
            },
          ];

          panel.targets = [
            {
              "aggregator": "p99",
              "currentTagKey": "",
              "currentTagValue": "",
              "downsampleAggregator": "avg",
              "errors": {},
              "metric": "",
              "tags": {
                "host": "*",
                "pid_cmd": "*"
              },
              "alias": "HOST: $tag_host PID: $tag_pid_cmd"
            }
          ];

          panel.sort.col = 2;
        });

        cpuTopN.targets[0].metric = 'cpu.topN';
        memoryTopN.targets[0].metric = 'mem.topN';
      };

      $timeout(function () {
        $scope.init();
      });
    });
  });
