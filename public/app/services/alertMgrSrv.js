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
    var alertUrl = "";
    //var alertUrl = "http://0.0.0.0:5001/alert/definition";

    this.init = function() {
      backendSrv.get('/api/alertsource').then(function(result) {
        alertUrl = result.alert.alert_url;
      });
    };

    this.load = function() {
      return $http({
        method: "get",
        url: alertUrl,
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
        url: alertUrl,
        data: angular.toJson(alertDef),
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.remove = function(alertId) {
      return $http({
        method: "delete",
        url: alertUrl,
        params: {id: alertId},
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.get = function(id) {
      return self.alertDefMap[id];
    };

    this.init();

  });
});
