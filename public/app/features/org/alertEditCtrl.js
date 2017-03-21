define([
  'angular',
  'lodash',
  'app/core/utils/datemath'
],
function (angular, _, dateMath) {
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
              "downsampleAggregator": "",
              "downsampleInterval":"1m",
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
      } else {
        $scope.setTarget(panelMeta,$scope.alertDef);
        $scope.setCritThreshold(panelMeta,$scope.alertDef);
        $scope.setWarnThreshold(panelMeta,$scope.alertDef);
      }
      $scope.orgName = contextSrv.user.orgName;
      $scope.serviceName = backendSrv.getSystemById(contextSrv.system);
     
      $scope.initDashboard({
        meta: {canStar: false, canShare: false, canEdit: false, canSave: false},
        dashboard: {
          system: contextSrv.system,
          title: "报警预览",
          id: "name",
          rows: [panelMeta],
          time: {from: "now-2h", to: "now"}
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
    }

    $scope.refreshPreview = function() {
      $scope.setTarget($scope.dashboard.rows[0],$scope.alertDef);
      $scope.broadcastRefresh();
    };

    $scope.setTarget = function(panel,detail) {
      panel.panels[0].targets[0].aggregator = detail.alertDetails.hostQuery.metricQueries[0].aggregator.toLowerCase();
      panel.panels[0].targets[0].downsampleAggregator = detail.alertDetails.hostQuery.metricQueries[0].aggregator.toLowerCase();
      panel.panels[0].targets[0].metric = detail.alertDetails.hostQuery.metricQueries[0].metric;
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

    $scope.init();
  });
});
