define([
  'angular',
  'lodash',
  'app/core/config',
],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SystemOverviewCtrl', function ($scope, $location, $q, backendSrv, alertSrv,
      contextSrv, datasourceSrv, alertMgrSrv, healthSrv, serviceDepSrv, jsPlumbService) {

      var toolkit = jsPlumbService.getToolkit("serviceToolkit");

      $scope.$on('$destroy', function () {
        toolkit.clear();
      });

      $scope.getUrl = function(url) {
        return config.appSubUrl + url;
      };

      $scope.percentFormatter = function (value) {
        return value && (value.toFixed(2) + '%');
      };

      $scope.gbFormatter = function (value) {
        return value && ((value / Math.pow(1024, 3)).toFixed(2) + 'GB');
      };

      $scope.statusFormatter = function (value) {
        return value > 0 ? '异常' : '正常';
      };

      var setPie = function (element, pieData, colors, innerRadius) {
        $.plot(element, pieData, {
          series: {
            pie: {
              innerRadius: innerRadius || 0.7,
              show: true,
            }
          },
          colors: colors
        });
      };

      $scope.init = function () {
        $scope.healthPanel = {};
        $scope.alertPanel  = {};
        $scope.exceptionPanel = {};
        $scope.anomalyPanel   = {};
        $scope.servicePanel   = {};
        $scope.hostPanel      = {};
        $scope.predictionPanel = {};
        $scope.panels = {};

        if (contextSrv.user.systemId == 0 && contextSrv.user.orgId) {
          $location.url("/systems");
          contextSrv.sidmenu = false;
          return;
        }

        backendSrv.get('/api/static/template/overview').then(function (response) {
          $scope._dashboard = response;
          $scope.getAlertStatus();
          $scope.getHostSummary();
          $scope.getAnomaly();
          $scope.getSystemAnomaly();
        }).then(function () {
          $scope.initDashboard({
            meta     : { canStar: false, canShare: false, canEdit: false, canSave: false },
            dashboard: $scope._dashboard
          }, $scope);
        });
      };

      // 报警情况
      $scope.getAlertStatus = function () {
        // var alertPanel = $scope._dashboard.rows[1].panels[0];
        $scope.alertPanel.status = [
          { type: 'success', text: '系统正常', count: 0 },
          { type: 'warning', text: '警告: ', count: 0 },
          { type: 'danger', text: '严重: ', count: 0 }
        ];
        $scope.alertPanel.href = $scope.getUrl('/alerts/status');

        alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
          if (response.data.length) {
            for (var i = 0; i < response.data.length; i++) {
              response.data[i].status.level === "CRITICAL" ? $scope.alertPanel.status[2].count++ : $scope.alertPanel.status[1].count++;
            }
          } else {
            $scope.alertPanel.status[0].text = '';
            $scope.alertPanel.status[0].count = '系统正常';
          }
        });
      };

      // 系统异常情况 anomaly
      $scope.getSystemAnomaly = function () {
        $scope.exceptionPanel.status = [
          { type: 'danger', text: 'CPU: ', count: 0, threadhold: '80%' },
          { type: 'danger', text: 'Memory: ', count: 0, threadhold: '80%' }
        ];

        backendSrv.alertD({
          method: "get",
          url: "/summary/topn?" + "threadhold=80"
        }).then(function (response) {
          response = response.data;
          if (response.mem.count) {
            $scope.exceptionPanel.status[1].count = response.mem.count;
            $scope.exceptionPanel.memTopList = response.mem.topList;
          }
          if (response.cpu.count) {
            $scope.exceptionPanel.status[0].count = response.cpu.count;
            $scope.exceptionPanel.cpuTopList = response.cpu.topList;
          }
        });
      };

      // 智能检测异常指标 & 健康指数
      $scope.getAnomaly = function () {
        // var healthPanel  = $scope._dashboard.rows[0].panels[0];
        // var anomalyPanel = $scope._dashboard.rows[2].panels[0];

        $scope.anomalyPanel.status = [
          { type: 'danger', text: '严重: ', count: 0 },
          { type: 'warning', text: '异常指标: ', count: 0 },
          { type: 'success', text: '指标数量: ', count: 0 }
        ];
        $scope.anomalyPanel.href = $scope.getUrl('/anomaly');

        healthSrv.load().then(function (data) {
          var healthScore = Math.floor(data.health);
          $scope.healthPanel.score = healthScore;
          $scope.healthPanel.level  = _.getLeveal(healthScore);

          var colors = healthScore > 75 ? ['#3DB779'] : (healthScore > 50 ? ['#FE9805'] : ['#BB1144'])
          setPie('.health-pie', [
            { label: "", data: healthScore },
            { label: "", data: 100 - healthScore }
          ], colors.concat(['#F3F7FA']));

          if (data.numAnomalyMetrics) {
            $scope.anomalyPanel.status[2].count = data.numMetrics;
            $scope.anomalyPanel.status[1].count = data.numAnomalyMetrics;
          } else {
            $scope.anomalyPanel.status[2].text  = '系统正常';
            $scope.anomalyPanel.status[2].count = 1;
          }
        });
      };

      // 服务状态
      $scope.getServices = function (scope) {
        toolkit = scope.toolkit;
        $scope.servicePanel.href = $scope.getUrl('/service_v2');

        serviceDepSrv.readServiceDependency().then(function (response) {
          if (!_.isNull(response.data)) {
            var dependencies = angular.fromJson(_.last(response.data).attributes[0].value);

            _.each(dependencies.nodes, function (node) {
              serviceDepSrv.readServiceStatus(node.id, node.name).then(function (resp) {
                node.status = resp.data.healthStatusType;
              });
            });

            toolkit.load({ data: dependencies });
          } else {
            alertSrv.set("抱歉", "您还没有创建服务依赖关系, 建议您先创建", "error", 2000);
          }
        });
      };

      $scope.nodeClickHandler = function (node) {
        $(node.el).addClass("active").siblings().removeClass("active");

        $scope.hostPanel = {};

        var serviceId = node.node.data.id;
        var serviceName = node.node.data.name;
        var serviceStatus = node.node.data.status;
        var hosts = [];

        $scope.hostPanel.currentService = {
          id: serviceId,
          name: serviceName,
          status: serviceStatus
        };

        serviceDepSrv.readHostStatus(serviceId, serviceName).then(function (response) {
          hosts = Object.keys(response.data.hostStatusMap);
        }).then(function () {
          $scope.hostPanel.hosts = [];

          _.each(hosts, function (host) {
            $scope.hostPanel.hosts.push(_.findWhere($scope.hostPanels, { host: host }))
          });
        }).then(function () {
          _.each(hosts, function (host) {
            $scope.showPrediction(0, host);
          });

          $scope.$broadcast("toggle-panel");
        });
      };

      $scope.selectHost = function (index, host) {
        $scope.selected = ($scope.selected == index) ? -1 : index;

        $scope.bsTableData = $scope.panels[host].topNPanel;
        $scope.$broadcast('load-table');

        $scope.predictionPanel = $scope.panels[host].predictionPanel;
        _.forIn($scope.predictionPanel, function (item, key) {
          var score = parseFloat(item.tips[0].data);
          var colors = score > 75 ? ['#BB1144'] : (score > 50 ? ['#FE9805'] : ['#3DB779']);

          setPie('.prediction-item-' + host + key, [
            { label: "", data: score },
            { label: "", data: 100 - score }
          ], colors.concat(['#DCDFE6']), 0.8);

          $scope.predictionPanel[key].selected = $scope.percentFormatter(score);
        });
      };

      // 机器连接状态
      $scope.getHostSummary = function () {
        var hostPanel = $scope._dashboard.rows[4].panels[0];
        
        $scope.hostPanel.href = $scope.getUrl('/summary');

        $scope.summaryList = [];
        var hostsResource = {};
        var promiseList = [];

        backendSrv.alertD({
          method : "get",
          url    : "/summary",
          params : { metrics: "collector.summary" },
          headers: { 'Content-Type': 'text/plain' },
        })
        .then(function (response) {
          $scope.summaryList = response.data;

          _.each($scope.summaryList, function (metric) {
            hostsResource[metric.tag.host] = {};
            hostsResource[metric.tag.host]["host"] = metric.tag.host;
          });
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".collector.state",
            "aggregator": "sum",
            "downsample": "1s-sum",
            "tags"      : { "host" : "*" }
          }];

          var q = datasourceSrv.getHostResource(queries, 'now-1m').then(function (response) {
            _.each(response, function (metric) {
              hostsResource[metric.host]["status"] = metric.value;
            });
          });
          promiseList.push(q);
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".cpu.usr",
            "aggregator": "avg",
            "downsample": "1h-avg",
            "tags"      : { "host" : "*" }
          }];

          var q = datasourceSrv.getHostResource(queries, 'now-1d').then(function (response) {
            _.each(response, function (metric) {
              hostsResource[metric.host]["cpu"] = $scope.percentFormatter(metric.value);
            });
          });
          promiseList.push(q);
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".df.bytes.free",
            "aggregator": "avg",
            "downsample": "1h-avg",
            "tags"      : { "host" : "*" }
          }];

          var q = datasourceSrv.getHostResource(queries, 'now-1d').then(function (response) {
            _.each(response, function (metric) {
              hostsResource[metric.host]["disk"] = $scope.gbFormatter(metric.value);
            });
          });
          promiseList.push(q);
        })
        .then(function () {
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + ".proc.meminfo.active",
            "aggregator": "avg",
            "downsample": "1h-avg",
            "tags"      : { "host" : "*" }
          }];

          var q = datasourceSrv.getHostResource(queries, 'now-1d').then(function (response) {
            _.each(response, function (metric) {
              hostsResource[metric.host]["mem"] = $scope.gbFormatter(metric.value);
            });
          });
          promiseList.push(q);
        })
        .finally(function () {
          $q.all(promiseList).then(function () {
            $scope.hostPanels = _.values(hostsResource);
          });
        });
      };

      // 智能分析预测 切换周期
      $scope.changePre = function (host, type, selectedOption) {
        var panel = $scope.panels[host]['predictionPanel'][type];
        var selected = _.findIndex(panel.tips, { time: selectedOption.time });
        var score = parseFloat(panel.tips[selected].data);

        panel.selected = $scope.percentFormatter(score);

        var colors = score > 75 ? ['#BB1144'] : (score > 50 ? ['#FE9805'] : ['#3DB779']);
        setPie('.prediction-item-' + host + type, [
          { label: "", data: score },
          { label: "", data: (100 - score) }
        ], colors.concat(['#DCDFE6']), 0.8);
      };

      $scope.showPrediction = function (i, hostname) {
        var predictionPanel = {};
        $scope.panels[hostname] = {};

        var titleMap = {
          disk: '磁盘剩余空间(%)',
          cpu : 'CPU使用情况(%)',
          mem : '内存使用情况(%)'
        };

        // 智能分析预测
        var prePanels = $scope._dashboard.rows[5].panels;
        _.each(prePanels, function (panel, index) {
          var params = {
            metric: contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + panel.targets[0].metric,
            host  : hostname
          };

          backendSrv.getPrediction(params).then(function (response) {
            var times = ['1天后', '1周后', '1月后', '3月后', '6月后'];
            var num   = 0;
            var data  = response.data;

            if (_.isEmpty(data)) { throw Error; }

            var type = /cpu/.test(panel.targets[0].metric) ? 'cpu' : (/mem/.test(panel.targets[0].metric) ? 'mem' : 'disk');
            predictionPanel[type] = {};
            predictionPanel[type].tips = [];
            predictionPanel[type].title = titleMap[type];

            for (var i in data) {
              var pre  = {
                time: times[num],
                data: index === 1 ? $scope.percentFormatter(data[i]) : $scope.gbFormatter(data[i])
              };

              predictionPanel[type].tips[num] = pre;
              num++;
            }

            predictionPanel[type]['selectedOption'] = predictionPanel[type].tips[0];
            $scope.panels[hostname]['predictionPanel'] = predictionPanel;
          }).catch(function () {
            panel.tip = '暂无预测数据';
          });
        });

        // topN
        var hostTopN = [];
        var temp = {};
        var promiseList = [];
        
        var topPanels = $scope._dashboard.rows[6].panels;
        _.each(topPanels, function (panel) {
          var metric = panel.targets[0].metric;
          var queries = [{
            "metric"    : contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + metric,
            "aggregator": "p99",
            "downsample": "1m-avg",
            "tags"      : { "host": hostname, "pid_cmd": "*" }
          }];

          var q = datasourceSrv.getHostResource(queries, 'now-1h').then(function (response) {
            var topN = metric.slice(0, metric.indexOf("."));
            temp[topN] = (response);
          }).finally(function () {
            var d = $q.defer();
            d.resolve();
            return d.promise;
          });

          promiseList.push(q);
        });

        $q.all(promiseList).then(function () {
          var tt = {};
          temp = temp.cpu.concat(temp.mem);

          _.each(temp, function (v) {
            if (!tt[v.tags.pid_cmd]) { tt[v.tags.pid_cmd] = {}; }
            
            tt[v.tags.pid_cmd]["pid"] = "HOST: " + v.tags.host + "&nbsp;&nbsp;&nbsp;&nbsp;PID: " + v.tags.pid_cmd;
            tt[v.tags.pid_cmd]["host"] = v.tags.host;

            /cpu/.test(v.name) && (tt[v.tags.pid_cmd]["cpu"] = $scope.percentFormatter(v.value));
            /mem/.test(v.name) && (tt[v.tags.pid_cmd]["mem"] = $scope.percentFormatter(v.value));
          });

          _.each(Object.keys(tt), function (v) {
            hostTopN.push(tt[v]);
          });

          $scope.panels[hostname]['topNPanel'] = hostTopN;
        }, function () {
          hostTopN = [];
        });
      };

      $scope.renderParams = {
        view : {
          nodes: {
            "default": {
              template: "node",
              events  : {
                click: $scope.nodeClickHandler
              }
            }
          }
        },
        layout:{
          type: "Absolute"
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
        consumeRightClick: false,
        enablePanButtons: false,
        enableWheelZoom: false
      };

      $scope.init();
    });
  });
