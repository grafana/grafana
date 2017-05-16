define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertEditCtrl', function($scope, $routeParams, $location, alertMgrSrv, alertSrv, datasourceSrv, contextSrv, backendSrv) {

    $scope.init = function() {
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
        $scope.alertDef.service = contextSrv.system;
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
      }
      $scope.orgName = contextSrv.user.orgName;
      $scope.serviceName = backendSrv.getSystemById(contextSrv.system);
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
          system: contextSrv.system,
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
      panel.panels[0].targets[0].aggregator = detail.alertDetails.hostQuery.metricQueries[0].aggregator.toLowerCase();
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
      panel.panels[0].grid.threshold1 = Number(detail.alertDetails.crit.threshold);
    };

    $scope.setWarnThreshold = function (panel,detail) {
      panel.panels[0].grid.threshold2 = Number(detail.alertDetails.warn.threshold);
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
      $scope.alertDef.service = contextSrv.system;
      $scope.getTags($scope.target.tags, $scope.alertDef.alertDetails);

      alertMgrSrv.save($scope.alertDef).then(function onSuccess() {
        $location.path("alerts");
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };

    $scope.getTextValues = function(metricFindResult) {
      return _.map(metricFindResult, function(value) { return value.text; });
    };

    $scope.suggestMetrics = function(query, callback) {
      $scope.datasource.metricFindQuery('metrics(' + query + ')')
        .then($scope.getTextValues)
        .then(callback);
    };

    $scope.targetBlur = function() {
      $scope.target.errors = validateTarget($scope.target);

      // this does not work so good
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.setTags($scope.dashboard.rows[0].panels[0], $scope.target.tags);
      }
    };

    $scope.suggestTagKeys = function(query, callback) {
      $scope.datasource.metricFindQuery('suggest_tagk(' + query + ')')
        .then($scope.getTextValues)
        .then(callback);
    };

    $scope.suggestTagValues = function(query, callback) {
      $scope.datasource.metricFindQuery('suggest_tagv(' + query + ')')
        .then($scope.getTextValues)
        .then(callback);
    };

    $scope.addTag = function() {
      if (!$scope.addTagMode) {
        $scope.addTagMode = true;
        return;
      }

      if (!$scope.target.tags) {
        $scope.target.tags = {};
      }

      $scope.target.errors = validateTarget($scope.target);

      if (!$scope.target.errors.tags) {
        $scope.target.tags[$scope.target.currentTagKey] = $scope.target.currentTagValue;
        $scope.target.currentTagKey = '';
        $scope.target.currentTagValue = '';
        $scope.targetBlur();
      }
      $scope.addTagMode = false;
    };

    $scope.removeTag = function(key) {
      delete $scope.target.tags[key];
      $scope.targetBlur();
    };

    $scope.editTag = function(key, value) {
      $scope.removeTag(key);
      $scope.target.currentTagKey = key;
      $scope.target.currentTagValue = value;
      $scope.addTag();
    };

    function validateTarget(target) {
      var errs = {};

      if (target.shouldDownsample) {
        try {
          if (target.downsampleInterval) {
            kbn.describe_interval(target.downsampleInterval);
          } else {
            errs.downsampleInterval = "您必须提供采样的间隔 (e.g. '1m' or '1h').";
          }
        } catch(err) {
          errs.downsampleInterval = err.message;
        }
      }

      if (target.tags && _.has(target.tags, target.currentTagKey)) {
        errs.tags = "重复标签'" + target.currentTagKey + "'.";
      }

      return errs;
    }

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
    }

    $scope.init();
  });
});
