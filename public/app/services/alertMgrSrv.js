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

    this.init = function() {
      backendSrv.get('/api/alertsource').then(function(result) {
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
        params: {service: "com.test"}
      });
    };

    this.loadAssociatedMetrics = function(alertId) {
      return $http({
        method: "get",
        url: alertAssociationUrl,
        params: {id: alertId}
      });
    };

  });
});
