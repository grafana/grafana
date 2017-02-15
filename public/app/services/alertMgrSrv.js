define([
  'angular',
  'lodash',
  'config',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('alertMgrSrv', function(alertSrv, backendSrv) {
    this.alertDefMap = {};
    var self = this;
    var alertDefUrl = "/alert/definition";
    var alertStatusUrl = "/alert/status";
    var alertAssociationUrl = "/alert/correlation";

    this.currentCritialThreshold = 0;
    this.currentWarningThreshold = 0;

    this.load = function() {
      return backendSrv.alertD({
        method: "get",
        url: alertDefUrl,
      }).then(function onSuccess(response) {
        for (var i = 0; i < response.data.length; i++) {
          var theAlertDef = response.data[i];
          self.alertDefMap[theAlertDef.id] = theAlertDef;
        }
        return response;
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 5000);
        return response;
      });
    };

    this.save = function(alertDef) {
      return backendSrv.alertD({
        method: "post",
        url: alertDefUrl,
        data: angular.toJson(alertDef),
        headers: {'Content-Type': 'text/plain;application/json;charset=UTF-8'},
      });
    };

    this.remove = function(alertId) {
      return backendSrv.alertD({
        method: "delete",
        url: alertDefUrl,
        params: {id: alertId},
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.get = function(id) {
      return self.alertDefMap[id];
    };

    this.loadTriggeredAlerts = function() {
      return backendSrv.alertD({
        method: "get",
        url: alertStatusUrl,
        params: {}
      });
    };

    this.loadAssociatedMetrics = function(alertMetric, alertHost, threshold) {
      return backendSrv.alertD({
        method: "get",
        url: alertAssociationUrl,
        params: {metric: alertMetric, host: alertHost, distance: threshold}
      });
    };

    this.resetCorrelation = function(alertMetric, alertHost, backtrackSteps, advancedSteps) {
      return backendSrv.alertD({
        method: "post",
        url: alertAssociationUrl,
        params: {
          metric: alertMetric,
          host: alertHost,
          backtrackSteps: backtrackSteps,
          advancedSteps: advancedSteps,
          reset: true
        },
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.resetCurrentThreshold = function (alertDetial) {
      self.currentWarningThreshold = alertDetial.warn.threshold;
      self.currentCritialThreshold = alertDetial.crit.threshold;
    };
  });
});
