define([
    'angular',
    'lodash',
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.filter('formatItemType', function () {
      return function (text) {
        return text.replace('Host', '').replace('Service', '');
      };
    });

    module.controller('ServiceStatusCtrl', function ($scope, $timeout, $q, $location,
      serviceDepSrv, jsPlumbService, alertSrv, backendSrv) {

      var toolkit = jsPlumbService.getToolkit("serviceToolkit");

      $scope.$on('$destroy', function () {
        toolkit.clear();
      });

      $scope.service = {};

      $scope.init = function (scope) {
        toolkit = scope.toolkit;

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
            alertSrv.set("抱歉", "您还没有创建服务依赖关系, 即将跳转至创建页面", "error", 2000);
            $timeout(function () {
              $location.url("/service_dependency");
            }, 2000);
          }
        });
      };

      $scope.nodeClickHandler = function (node) {
        $scope.selected = -1;
        $(node.el).addClass("active").siblings().removeClass("active");

        var serviceId = node.node.data.id;
        var serviceName = node.node.data.name;

        $scope.service = {};
        $scope.metrics = {};

        serviceDepSrv.readMetricStatus(serviceId, serviceName).then(function (response) {
          $scope.service = response.data;
        });

        // 拿 servicekpi metric 的 message, 储存在 _.metricHelpMessage 中
        var service = serviceName.split(".")[0];
        _.each([service, 'mem', 'io', 'nw', 'cpu'], function (item) {
          backendSrv.readMetricHelpMessage(item);
        });
      };

      $scope.selectHost = function(index, host) {
        // hack
        $scope.bsTableData = [];
        $scope.$broadcast('load-table');

        $scope.selected = ($scope.selected === index) ? -1 : index;

        $scope.selectHealthItemType(host, 'ServiceKPI');
      };

      $scope.selectHealthItemType = function (host, item) {
        var metrics = $scope.service.hostStatusMap[host].itemStatusMap[item].metricStatusMap;
        var metric = [];
        var alertLevel = "";

        for (var name in metrics) {
          switch (metrics[name].alertLevel) {
            case "CRITICAL":
              alertLevel = "严重";
              break;
            case "WARNING":
              alertLevel = "警告";
              break;
            default:
              alertLevel = "正常";
              break;
          }
          metric.push({
            name: name,
            alertRuleSet: metrics[name].alertRuleSet ? "有" : "无",
            alertLevel: alertLevel,
            anomalyHealth: metrics[name].health
          });
        }

        $scope.currentHost = host;
        $scope.currentItem = item;
        $scope.currentItemStatus = $scope.service.hostStatusMap[host].itemStatusMap[item].healthStatusType;
        $scope.bsTableData = metric;

        $scope.$broadcast('load-table');
      };

      $scope.renderParams = {
        view : {
          nodes: {
            "default": {
              template: "node",
              events: {
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
        consumeRightClick: false
      };

      // 弹窗 查看历史情况
      $scope.showModal = function (index, metric, host) {
        // TODO
        return;
      };

    });
  }
);