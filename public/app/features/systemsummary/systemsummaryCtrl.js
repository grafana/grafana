define([
  'angular',
  'lodash',
  'app/core/config',
],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SystemsummaryCtrl', function ($scope, $location, backendSrv, contextSrv, datasourceSrv, alertMgrSrv, healthSrv, $timeout, $q) {
      $scope.getUrl = function(url) {
        return config.appSubUrl + url;
      };

      $scope.init = function () {
        if (contextSrv.user.systemId == 0 && contextSrv.user.orgId) {
          $location.url("/systems");
          contextSrv.sidmenu = false;
          return;
        }

        backendSrv.get('/api/static/template/system').then(function (response) {
          $scope._dashboard = response;
          $scope.getServices().finally(function () {
            $scope.initDashboard({
              meta: { canStar: false, canShare: false, canEdit: false, canSave: false },
              dashboard: $scope._dashboard
            }, $scope);
          });
          $scope.getAlertStatus();
          $scope.getHostSummary();
          $scope.getHealth();
          $scope.getPrediction();
        });
      };

      $scope.getAlertStatus = function () {
        var panel = $scope._dashboard.rows[0].panels[0];
        panel.href = $scope.getUrl('/alerts/status');
        panel.status = {
          success: ['', ''],
          warn: ['警告', 0],
          danger: ['严重', 0]
        };
        alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
          if (response.data.length) {
            for (var i = 0; i < response.data.length; i++) {
              var alertDetail = response.data[i];
              if (alertDetail.status.level === "CRITICAL") {
                panel.status.danger[1]++;
              } else {
                panel.status.warn[1]++;
              }
            }
          } else {
            panel.status.success[1] = '系统正常';
          }
        });
      };

      $scope.getServices = function () {
        var panel = $scope._dashboard.rows[2].panels[0];
        panel.href = $scope.getUrl('/service');
        panel.status = { success: ['正常服务', 0], warn: ['异常服务', 0], danger: ['严重', 0] };
        var promiseList = [];
        _.each(Object.keys(_.allServies()), function (key) {
          var queries = [{
            "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + key + ".state",
            "aggregator": "sum",
            "downsample": "10m-sum",
          }];

          var q = datasourceSrv.getServiceStatus(queries, 'now-10m').then(function (response) {
            if (response.status > 0) {
              panel.status.warn[1]++;
            } else {
              panel.status.success[1]++;
            }
            var targets = {
              "aggregator": "sum",
              "currentTagKey": "",
              "currentTagValue": "",
              "downsampleAggregator": "sum",
              "downsampleInterval": "10m",
              "errors": {},
              "hide": false,
              "isCounter": false,
              "metric": key + '.state',
              "shouldComputeRate": false,
            };
            panel.targets.push(targets);
          }).finally(function () {
            var d = $q.defer();
            d.resolve();
            return d.promise;
          });
          promiseList.push(q);
        });
        return $q.all(promiseList)
      };

      $scope.getHostSummary = function () {
        var panel = $scope._dashboard.rows[3].panels[0];
        panel.href = $scope.getUrl('/summary');
        panel.status = { success: ['正常机器', 0], warn: ['异常机器', 0], danger: ['尚未工作', 0] };
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
                panel.status.warn[1]++;
              } else {
                panel.status.success[1]++;
              }
            },function(err) {
              panel.status.danger[1]++;
            });

          });
        })
      };

      $scope.getHealth = function () {
        var panel = $scope._dashboard.rows[1].panels[0];
        panel.href = $scope.getUrl('/anomaly');
        panel.status = { success: ['指标数量', 0], warn: ['异常指标', 0], danger: ['严重', 0] };
        healthSrv.load().then(function (data) {
          $scope.applicationHealth = Math.floor(data.health);
          $scope.leveal = _.getLeveal($scope.applicationHealth);
          $scope.summary = data;
          if (data.numAnomalyMetrics) {
            panel.status.success[1] = data.numMetrics;
            panel.status.warn[1] = data.numAnomalyMetrics;
          } else {
            panel.status.success[0] = '';
            panel.status.success[1] = '系统正常';
          }
        });
      };

      $scope.getPrediction = function () {
        var panels = $scope._dashboard.rows[6].panels;
        _.each(panels, function (panel, index) {
          var params = {
            metric: contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + panel.targets[0].metric,
          }

          backendSrv.getPrediction(params).then(function(response) {
            var num = 0;
            var times = ['1天后','1周后','1月后','1季度后','半年后'];
            var data = response.data;
            if(_.isEmpty(data)) {
              throw Error;
            }
            for(var i in data) {
              var pre = {time: '', data: ''};
              pre.time = times[num];
              if(index === 1) {
                pre.data = data[i].toFixed(2) + '%';
              } else {
                pre.data = (data[i] / Math.pow(1024, 3)).toFixed(2) + 'GB'
              }
              panel.tips.push(pre);
              num++;
            }
            panel.selectedOption = panel.tips[0];
          }).catch(function(err) {
            panel.tip = '暂无预测数据';
          });
        });
      };

      $scope.changePre = function (selectedOption) {
        var panels = $scope._dashboard.rows[6].panels;
        var selected = _.findIndex(panels[0].tips,{time: selectedOption.time});
        _.each(panels, function(panel, index) {
          panel.selectedOption = panel.tips[selected];
        });
      };

      $scope.init();
    });
  });
