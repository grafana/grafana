define([
  'angular',
  'lodash',
  'config',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('alertMgrSrv', function($http, alertSrv) {
    this.alertDefMap = {};
    var self = this;
    var alertUrl = "http://0.0.0.0:5001/alert/definition";

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
        alertSrv.set("error", response.status + " " + (response.message || "Request failed"), response.severity, 50);
        return response;
      });
    };

    this.save = function(json) {
      return $http.post(alertUrl, json});
    }

    this.get = function(id) {
      return self.alertDefMap[id];
    };
  });
});
