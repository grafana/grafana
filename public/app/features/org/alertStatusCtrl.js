define([
  'angular',
  'moment',
  'lodash',
  'app/core/utils/datemath'
],
function (angular, moment, _, dateMath) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertStatusCtrl', function ($scope, alertMgrSrv, datasourceSrv) {
    $scope.init = function () {
      $scope.correlationThreshold = 100;
      alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
        $scope.alertRows = response.data;
        $scope.getCurrent();
      });
    };
    $scope.resetCurrentThreshold = function (alertDetails) {
      alertMgrSrv.resetCurrentThreshold(alertDetails);
    };

    $scope.handleAlert = function () {
      $scope.appEvent('show-modal', {
        src: './app/partials/handle_alert.html',
        modalClass: 'modal-no-header confirm-modal',
        scope: $scope.$new()
      });
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
    $scope.random = function () {
      // There would be something problems when render the page;
      return Math.floor(Math.random() * 100) + 20;
    };

    $scope.formatDate = function (mSecond) {
      return moment(mSecond).format("YYYY-MM-DD HH:mm:ss");
    };

    $scope.timeFrom = function (mSecond, snoozeMin) {
      return moment(mSecond).add(snoozeMin, 'm').format("YYYY-MM-DD HH:mm");
    };

    $scope.getCurrent = function () {
      _.each(datasourceSrv.getAll(), function (ds) {
        if (ds.type === 'opentsdb') {
          datasourceSrv.get(ds.name).then(function (datasource) {
            $scope.datasource = datasource;
          }).then(function () {
            _.each($scope.alertRows, function (alertData) {
              var queries = [{
                "metric": alertData.metric,
                "aggregator": "avg",
                "downsample": "1m-avg",
                "tags": {"host": alertData.status.monitoredEntity}
              }];

              $scope.datasource.performTimeSeriesQuery(queries, dateMath.parse('now-2m', false).valueOf(), null).then(function (response) {
                if (_.isEmpty(response.data)) {
                  throw Error;
                }
                _.each(response.data, function (currentData) {
                  if (_.isObject(currentData)) {
                    alertData.curr = Math.floor(currentData.dps[Object.keys(currentData.dps)[0]] * 1000) / 1000;
                    if(isNaN(alertData.curr)){
                      alertData.curr = "没有数据";
                    }
                  }
                });
              }).catch(function () {
                alertData.curr = "没有数据";
              });
            });
          });
        }
      });
    }

    $scope.init();
  });
});
