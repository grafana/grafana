define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertEditCtrl', function($scope, $routeParams, $location, alertMgrSrv, alertSrv, datasourceSrv, contextSrv, backendSrv, $controller) {

    $scope.init = function() {
      $scope.checkStatus = {
        name: '',
        checkName: true,
      };
      $scope.unInit = true;
      $controller('OpenTSDBQueryCtrl', {$scope: $scope});
      $scope.targetBlur = $scope._targetBlur;
      $scope.datasource = null;
      _.each(datasourceSrv.getAll(), function(ds) {
        if (ds.type === 'opentsdb') {
          datasourceSrv.get(ds.name).then(function(datasource) {
            $scope.datasource = datasource;
          });
        }
      });
      var panelMeta = {
        "collapse": false,
        "editable": false,
        "height": "260px",
        "panels": [
          {
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
              "currentTagKey":"",
              "currentTagValue":"",
              "downsampleAggregator": "avg",
              "downsampleInterval":"5m",
              "errors":{},
              "hide":false,
              "isCounter":false,
              "metric": "",
              "shouldComputeRate":false,
              "tags":{"host":"*"}
            }],
            "grid": {
                "threshold1": "",
                "threshold1Color": "rgba(251, 0, 0, 0.57)",
                "threshold2": "" ,
                "threshold2Color": "rgba(216, 169, 27, 0.61)",
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
            "transparent": true
          }
        ],
        "showTitle": false,
        "title": "New row"
      };

      $scope.alertDef = alertMgrSrv.get($routeParams.id);
      $scope.target = {'tags':{}};
      $scope.isNew = !$scope.alertDef;
      if ($scope.isNew) {
        $scope.alertDef = {};
        $scope.alertDef.org = contextSrv.user.orgId;
        $scope.alertDef.service = contextSrv.user.systemId;
        $scope.alertDef.alertDetails = {};
        $scope.alertDef.alertDetails.cluster = "cluster1";
        $scope.alertDef.alertDetails.hosts = null;
        $scope.alertDef.alertDetails.membership = "*";
        $scope.alertDef.alertDetails.monitoringScope = "HOST";
        $scope.alertDef.alertDetails.hostQuery = {};
        $scope.alertDef.alertDetails.hostQuery.expression = ">";
        $scope.alertDef.alertDetails.hostQuery.metricQueries = [{"aggregator": "AVG","metric":""}];
        $scope.alertDef.alertDetails.tags = null;
      } else {
        $scope.setTarget(panelMeta,$scope.alertDef);
        $scope.setCritThreshold(panelMeta,$scope.alertDef);
        $scope.setWarnThreshold(panelMeta,$scope.alertDef);
        $scope.checkStatus.name = $scope.alertDef.name;
        $scope.checkStatus.checkName = false;
        $scope.alertDef.alertDetails.hosts = $scope.alertDef.alertDetails.hosts ? $scope.alertDef.alertDetails.hosts.toString() : null;
      }
      $scope.orgName = contextSrv.user.orgName;
      $scope.serviceName = backendSrv.getSystemById(contextSrv.user.systemId);
      $scope.timeRange = [
        {id:'2h',txt:'2小时之前'},
        {id:'12h',txt:'12小时之前'},
        {id:'24h',txt:'24小时之前'},
        {id:'3d',txt:'3天之前'},
        {id:'7d',txt:'1周之前'},
        {id:'1M',txt:'1月之前'},
      ];
      $scope.timeSelected = "12h";
      $scope.initDashboard({
        meta: {canStar: false, canShare: false, canEdit: false, canSave: false},
        dashboard: {
          title: "报警预览",
          id: "name",
          rows: [panelMeta],
          time: {from: "now-12h", to: "now"}
        }
      }, $scope);
    };

    $scope.addThreshold = function (type) {
      if(type){
        $scope.setCritThreshold($scope.dashboard.rows[0],$scope.alertDef);
      }else{
        $scope.setWarnThreshold($scope.dashboard.rows[0],$scope.alertDef);
      }
      $scope.$broadcast('render');
    };

    $scope.refreshPreview = function() {
      $scope.setTarget($scope.dashboard.rows[0],$scope.alertDef);
      $scope.broadcastRefresh();
    };

    $scope.setTarget = function(panel,detail) {
      if(detail.alertDetails.hostQuery.metricQueries[0].aggregator) {
        panel.panels[0].targets[0].aggregator = detail.alertDetails.hostQuery.metricQueries[0].aggregator.toLowerCase();
      };
      panel.panels[0].targets[0].metric = detail.alertDetails.hostQuery.metricQueries[0].metric;
      var tags = detail.alertDetails.tags;
      _.each(tags, function(tag) {
        panel.panels[0].targets[0].tags[tag.name] = tag.value;
        $scope.target.tags[tag.name] = tag.value;
      });
    };

    $scope.setTimeRange = function () {
      $scope.dashboard.time.from = "now-" + $scope.timeSelected;
      if($scope.alertDef.alertDetails.hostQuery.metricQueries[0].metric){
        $scope.broadcastRefresh();
      }
    };

    $scope.setCritThreshold = function (panel,detail) {
      if(detail.alertDetails.crit.threshold) {
        panel.panels[0].grid.threshold1 = Number(detail.alertDetails.crit.threshold);
      };
    };

    $scope.setWarnThreshold = function (panel,detail) {
      if(detail.alertDetails.warn.threshold) {
        panel.panels[0].grid.threshold2 = Number(detail.alertDetails.warn.threshold);
      };
    };

    $scope.saveChanges = function() {
      var milliseconds = (new Date).getTime();
      if ($scope.isNew) {
        //if it is new, we need to fill in some hard-coded value for now.
        $scope.alertDef.creationTime = milliseconds;
        $scope.alertDef.modificationTime = milliseconds;
      } else {
        $scope.alertDef.modificationTime = milliseconds;
      }
      $scope.alertDef.org = contextSrv.user.orgId;
      $scope.alertDef.service = contextSrv.user.systemId;
      $scope.getTags($scope.target.tags, $scope.alertDef.alertDetails);
      $scope.alertDef.alertDetails.hosts = $scope.alertDef.alertDetails.hosts ? $scope.alertDef.alertDetails.hosts.split(',') : null;

      alertMgrSrv.save($scope.alertDef).then(function onSuccess() {
        $location.path("alerts");
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };

    $scope.getTags = function(tags, detail) {
      detail.tags = [];
      for(var i in tags) {
        var temp = {
          'name': i,
          'value': tags[i]
        };
        detail.tags.push(temp);
      };
    };

    $scope.setTags = function(panel, tags) {
      panel.targets[0].tags = tags;
      $scope.broadcastRefresh();
    };

    $scope._targetBlur = function() {
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.setTags($scope.dashboard.rows[0].panels[0], $scope.target.tags);
      }
    };

    $scope.checkName = function() {
      if($scope.checkStatus.name === $scope.alertDef.name) {
        $scope.checkStatus.checkName = false;
        return;
      } else {
        alertMgrSrv.checkName($scope.alertDef.name).then(function(response) {
          $scope.checkStatus.checkName = response.data.exist;
          if($scope.checkStatus.checkName){
            alertSrv.set("已存在该报警", "请修改报警名称", "error", 5000);
          }
        });
      }
    }

    $scope.init();
  });
});
