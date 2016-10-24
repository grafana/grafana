define([
  'angular',
  'lodash',
  'config',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('alertMgrSrv', function($http, alertSrv, backendSrv) {
    this.alertDefMap = {};
    var self = this;
    var alertUrlRoot = "";
    var alertDefUrl = "";
    var alertStatusUrl = "";
    var alertAssociationUrl = "";

    this.currentCritialThreshold = 0;
    this.currentWarningThreshold = 0;
    this.init = function() {
      backendSrv.updateSystemsMap();
      backendSrv.get('/api/alertsource').then(function(result) {
        // TODO: add current user's org name as filters. Otherwise, he will see all alerts not in his org.
        alertUrlRoot = result.alert.alert_urlroot;
        alertDefUrl = alertUrlRoot + "/alert/" + "definition";
        alertStatusUrl = alertUrlRoot + "/alert/" + "status";
        alertAssociationUrl = alertUrlRoot + "/alert/" + "correlation";
      });
    };

    this.load = function() {
      return $http({
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
      return $http({
        method: "post",
        url: alertDefUrl,
        data: angular.toJson(alertDef),
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.remove = function(alertId) {
      return $http({
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
      return $http({
        method: "get",
        url: alertStatusUrl,
        params: {} // TODO: filtered by "org" and "service".
      });
    };

    this.loadAssociatedMetrics = function(alertMetric, alertHost, threshold) {
      return $http({
        method: "get",
        url: alertAssociationUrl,
        params: {metric: alertMetric, host: alertHost, distance: threshold}
      });
    };

    this.resetCorrelation = function(alertMetric, alertHost, backtrackSteps, advancedSteps) {
      return $http({
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
