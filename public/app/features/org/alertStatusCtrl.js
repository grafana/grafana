define([
  'angular',
  'moment',
  'lodash',
],
function (angular, moment, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertStatusCtrl', function ($scope, alertMgrSrv, datasourceSrv, contextSrv, integrateSrv, $location) {
    var annotation_tpl = {
      annotation: {
        datasource: "elk",
        enable: true,
        iconColor: "rgba(19, 21, 19, 0.7)",
        iconSize: 15,
        lineColor: "rgba(255, 96, 96, 0.592157)",
        name: "123",
        query: "*",
        showLine: true,
        textField: "123",
        timeField: ""
      },
      min: 1495032982939,
      max: 1495032982939,
      eventType: "123",
      title: ":",
      tags: "历史报警时间",
      text: "",
      score: 1
    };

    $scope.init = function () {
      $scope.correlationThreshold = 100;
      alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
        for (var i = 0; i < response.data.length; i++) {
          var alertDetail = response.data[i];
          if (alertDetail.status.level === "CRITICAL") {
            alertDetail.definition.alertDetails.threshold = alertDetail.definition.alertDetails.crit.threshold;
          } else {
            alertDetail.definition.alertDetails.threshold = alertDetail.definition.alertDetails.warn.threshold;
          }
          // Only show 2 digits. +0.00001 is to avoid floating point weirdness on rounding number.
          alertDetail.status.triggeredValue = Math.round((alertDetail.status.triggeredValue + 0.00001) * 100) / 100;
        }
        $scope.alertRows = response.data;
        $scope.getCurrent();
      });
      $scope.getLevel = alertMgrSrv.getLevel;
    };
    $scope.resetCurrentThreshold = function (alertDetail) {
      var metric = _.getMetricName(alertDetail.metric);
      var def_zh = alertDetail.definition.name;
      var host = alertDetail.status.monitoredEntity;
      alertMgrSrv.resetCurrentThreshold(alertDetail.definition.alertDetails);
      alertMgrSrv.annotations = [{
        annotation: {
          datasource: "elk",
          enable: true,
          iconColor: "#C0C6BE",
          iconSize: 15,
          lineColor: "rgba(255, 96, 96, 0.592157)",
          name: "123",
          query: "*",
          showLine: true,
          textField: "123",
          timeField: ""
        },
        min: alertDetail.status.creationTime,
        max: alertDetail.status.creationTime,
        eventType: "123",
        title: "报警时间",
        tags: metric +","+ host,
        text: "[警报] "+def_zh,
        score: 1
      }];
    };

    $scope.handleAlert = function (alertDetail) {
      var newScope = $scope.$new();
      newScope.alertData = alertDetail;
      newScope.closeAlert = $scope.closeAlert;
      $scope.appEvent('show-modal', {
        src: './app/partials/handle_alert.html',
        modalClass: 'modal-no-header confirm-modal',
        scope: newScope
      });
    };

    $scope.closeAlert = function() {
      var status = $scope.alertData.status;
      alertMgrSrv.closeAlert(status.alertId, status.monitoredEntity, $scope.reason, contextSrv.user.name).then(function(response) {
        _.remove($scope.$parent.alertRows, function(alertDetail) {
          return (alertDetail.definition.id === status.alertId) &&  (alertDetail.status.monitoredEntity === status.monitoredEntity);
        });
        $scope.appEvent('alert-success', ['报警处理成功']);
      }).catch(function(err) {
        $scope.appEvent('alert-error', ['报警处理失败','请检查网络连接状态']);
      });
    };

    $scope.statusDetails = function(alertDetails) {
      var target = {
        tags: {},
        downsampleAggregator: "avg",
        downsampleInterval: "1m"
      };
      var alert = alertDetails;
      var details = alert.definition.alertDetails;
      var history = alert.history;
      var host = alert.status.monitoredEntity;
      var anno_create = alert.status.creationTime;
      var start_anno = _.cloneDeep(annotation_tpl);
      var options = integrateSrv.options;

      target.aggregator = details.hostQuery.metricQueries[0].aggregator.toLowerCase();
      target.metric = details.hostQuery.metricQueries[0].metric;
      target.tags.host = host;
      for (var tag in alert.definition.tags) {
        target.tags[tag.name] = tag.value;
      }
      start_anno.min = start_anno.max = anno_create;
      start_anno.title = "报警开始时间: ";
      options.targets = [target];
      options.title = target.metric + "异常情况";

      options.from = moment.utc(anno_create - 3600000).format("YYYY-MM-DDTHH:mm:ss.SSS\\Z");
      options.annotations = [start_anno];
      $location.path("/integrate");
    };
    $scope.handleSnooze = function(alertDetails) {
      var newScope = $scope.$new();
      newScope.alertDetails = alertDetails;
      $scope.appEvent('show-modal', {
        src: './app/partials/snooze_alert.html',
        modalClass: 'modal-no-header confirm-modal',
        scope: newScope
      });
    };
    $scope.formatDate = function (mSecond) {
      return moment(mSecond).format("YYYY-MM-DD HH:mm:ss");
    };

    $scope.timeFrom = function (mSecond, snoozeMin) {
      return moment(mSecond).add(snoozeMin, 'm').format("YYYY-MM-DD HH:mm");
    };

    $scope.getCurrent = function () {
      _.each($scope.alertRows, function (alertData) {
        var queries = [{
          "metric": alertData.metric,
          "aggregator": alertData.definition.alertDetails.hostQuery.metricQueries[0].aggregator.toLowerCase(),
          "downsample": "1m-avg",
          "tags": {"host": alertData.status.monitoredEntity}
        }];
        datasourceSrv.getServiceStatus(queries, 'now-2m').then(function(response) {
          alertData.curr = Math.floor(response.status * 1000) / 1000;
        },function(err) {
          alertData.curr = "没有数据";
        }).catch(function (err) {
          alertData.curr = "没有数据";
        });
      });
    };

    $scope.init();
  });
});
