define([
  'angular',
  'lodash',
  'app/core/config',
],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SystemOverviewCtrl', function ($scope, $location, backendSrv, contextSrv, datasourceSrv, alertMgrSrv, healthSrv, $timeout, $q) {
      $scope.getUrl = function(url) {
        return config.appSubUrl + url;
      };

      $scope.init = function () {
        if (contextSrv.user.systemId == 0 && contextSrv.user.orgId) {
          $location.url("/systems");
          contextSrv.sidmenu = false;
          return;
        }

        backendSrv.get('/api/static/template/overview').then(function (response) {
          $scope._dashboard = response;
          $scope.getServices().finally(function () {
            $scope.initDashboard({
              meta     : { canStar: false, canShare: false, canEdit: false, canSave: false },
              dashboard: $scope._dashboard
            }, $scope);
          });
          $scope.getAlertStatus();
          $scope.getHostSummary();
          $scope.getAnomaly();
          $scope.getPrediction();
          $scope.getHealth();
        });
      };

      $scope.getHealth = function () {
        var panel = $scope._dashboard.rows[0].panels[0];
      };

      // 报警情况
      $scope.getAlertStatus = function () {
        var panel = $scope._dashboard.rows[1].panels[0];
        panel.status = { success: ['', ''], warn: ['警告', 0], danger: ['严重', 0] };
        panel.href = $scope.getUrl('/alerts/status');

        alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
          if (response.data.length) {
            for (var i = 0; i < response.data.length; i++) {
              response.data[i].status.level === "CRITICAL" ? panel.status.danger[1]++ : panel.status.warn[1]++;
            }
          } else {
            panel.status.success[1] = '系统正常';
          }
        });
      };

      // 智能检测异常指标 & 健康指数
      $scope.getAnomaly = function () {
        var panel = $scope._dashboard.rows[2].panels[0];
        panel.status = { success: ['指标数量', 0], warn: ['异常指标', 0], danger: ['严重', 0] };
        panel.href = $scope.getUrl('/anomaly');

        healthSrv.load().then(function (data) {
          $scope.applicationHealth = Math.floor(data.health);
          $scope.leveal  = _.getLeveal($scope.applicationHealth);
          $scope.healthProgressState = $scope.applicationHealth > 75 ? 'success' : ($scope.applicationHealth > 50 ? 'warning' : 'danger');
          $scope.summary = data;

          if (data.numAnomalyMetrics) {
            panel.status.success[1] = data.numMetrics;
            panel.status.warn[1]    = data.numAnomalyMetrics;
          } else {
            panel.status.success[0] = '';
            panel.status.success[1] = '系统正常';
          }
        });
      };

      // 服务状态
      $scope.getServices = function () {
        var panel = $scope._dashboard.rows[3].panels[0];
        panel.status = { success: ['正常服务', 0], warn: ['异常服务', 0], danger: ['严重', 0] };
        panel.href = $scope.getUrl('/service');
        panel.allServices = [];

        var allServicesMap = _.allServies();
        var promiseList = [];

        _.each(Object.keys(allServicesMap), function (key) {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + key + ".state",
            "aggregator": "sum",
            "downsample": "1s-sum",
            "tags"      : { "host" : "*" }
          }];

          var q = datasourceSrv.getStatus(queries, 'now-5m').then(function (response) {
            var serviceState = 0;
            var serviceHosts = [];
            
            _.each(response, function(service) {
              if (_.isObject(service)) {
                var status = service.dps[_.last(Object.keys(service.dps))];
                
                if (status > 0) {
                  panel.status.warn[1]++;
                  serviceState++;
                } else {
                  panel.status.success[1]++;
                }

                serviceHosts.push({
                  "name": service.tags.host,
                  "state": status > 0 ? "异常" : "正常"
                });
              }
            });

            panel.allServices.push({
              "name" : allServicesMap[key],
              "state": serviceState,
              "hosts": serviceHosts
            });
            console.log(key, panel.allServices);
          }).finally(function () {
            var d = $q.defer();
            d.resolve();
            return d.promise;
          });
          promiseList.push(q);
        });
        return $q.all(promiseList);
      };

      // 机器连接状态
      $scope.getHostSummary = function () {
        var panel = $scope._dashboard.rows[4].panels[0];
        panel.status = { success: ['正常机器', 0], warn: ['异常机器', 0], danger: ['尚未工作', 0] };
        panel.href = $scope.getUrl('/summary');

        $scope.summaryList = [];
        $scope.hostsResource = {};
        $scope.hostPanels = [];

        backendSrv.alertD({
          method : "get",
          url    : "/summary",
          params : { metrics: "collector.summary" },
          headers: { 'Content-Type': 'text/plain' },
        })
        .then(function (response) {
          $scope.summaryList = response.data;
          _.each($scope.summaryList, function (metric) {
            $scope.hostsResource[metric.tag.host] = {};
            $scope.hostsResource[metric.tag.host]["host"] = metric.tag.host;
          });
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".collector.state",
            "aggregator": "sum",
            "downsample": "1s-sum",
            "tags"      : { "host" : "*" }
          }];
          
          datasourceSrv.getHostResource(queries, 'now-1m').then(function (response) {
            _.each(response, function (metric) {
              $scope.hostsResource[metric.host]["status"] = metric.value;
            });
          });
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".cpu.usr",
            "aggregator": "avg",
            "downsample": "1h-avg",
            "tags"      : { "host" : "*" }
          }];

          datasourceSrv.getHostResource(queries, 'now-1d').then(function (response) {
            _.each(response, function (metric) {
              $scope.hostsResource[metric.host]["cpu"] = metric.value;
            });
          });
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".df.bytes.free",
            "aggregator": "avg",
            "downsample": "1h-avg",
            "tags"      : { "host" : "*" }
          }];

          datasourceSrv.getHostResource(queries, 'now-1d').then(function (response) {
            _.each(response, function (metric) {
              $scope.hostsResource[metric.host]["disk"] = metric.value;
            });
          });
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".proc.meminfo.active",
            "aggregator": "avg",
            "downsample": "1h-avg",
            "tags"      : { "host" : "*" }
          }];

          datasourceSrv.getHostResource(queries, 'now-1d').then(function (response) {
            _.each(response, function (metric) {
              $scope.hostsResource[metric.host]["mem"] = metric.value;
            });
          });
        })
        .finally(function () {
          console.log("panel");
          _.each(Object.keys($scope.hostsResource), function (host) {
            $scope.hostsResource[host]["body"] = {};
            $scope.hostPanels.push($scope.hostsResource[host]);
            // if (typeof($scope.hostsResource[host]["status"]) == "number") {
              
            // }
          });
        })
      };

      // 智能分析预测
      $scope.getPrediction = function () {
        var panels = $scope._dashboard.rows[5].panels;
        
        _.each(panels, function (panel, index) {
          panel.targets.tags = { "host" : "centos25" }
          var params = {
            metric: contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + panel.targets[0].metric,
          };

          backendSrv.getPrediction(params).then(function (response) {
            var times = [ '1天后', '1周后', '1月后', '1季度后', '半年后' ];
            var num   = 0;
            var data  = response.data;
            
            if (_.isEmpty(data)) {
              throw Error;
            }

            for (var i in data) {
              var pre  = {
                time: times[num],
                data: index === 1 ? (data[i].toFixed(2) + '%') : ((data[i] / Math.pow(1024, 3)).toFixed(2) + 'GB')
              };
              panel.tips.push(pre);

              num++;
            }

            panel.selectedOption = panel.tips[0];
          }).catch(function (err) {
            panel.tip = '暂无预测数据';
          });
        });
      };
      
      // 智能分析预测 切换周期
      $scope.changePre = function (selectedOption) {
        var panels   = $scope._dashboard.rows[5].panels;
        var selected = _.findIndex(panels[0].tips, { time: selectedOption.time });

        _.each(panels, function (panel, index) {
          panel.selectedOption = panel.tips[selected];
        });
      };

      $scope.showPrediction = function (i) {
        console.log(i);
        $scope.hostPanels.activePanel = i;

        var panels = $scope._dashboard.rows[6].panels;
        _.each(panels, function (panel, index) {
          var metric = panel.targets[0].metric;
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + metric,
            "aggregator": "p99",
            "downsample": "1m-avg",
            "tags"      : { "host": $scope.hostPanels[i].host, "pid_cmd": "*" }
          }];

          datasourceSrv.getHostResource(queries, 'now-5m').then(function (response) {
            var topN = metric.slice(0, metric.indexOf("."));
            $scope.hostPanels[i].body[topN] = response;
          });
        });
      }

      $scope.test = function () {
        $scope._dashboard.rows[3].panels[0].allServices[0].hosts = $scope.hostPanels[7];
      }

      $scope.init();
    });
  });
