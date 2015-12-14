define([
  'angular',
  'lodash',
  'config',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('oncallerMgrSrv', function($http, oncallerSrv, backendSrv) {
    this.oncallerDefMap = {};
    var self = this;
    var alertUrlRoot = "";
    var oncallerUrl = "";

    this.init = function() {
      backendSrv.get('/api/alertsource').then(function(result) {
        //alertUrlRoot = result.alert.alert_urlroot;
        //oncallerUrl = alertUrlRoot + "/oncaller/" + "definition";
        oncallerUrl = "http://10.0.0.117:5001/oncaller/definition";
      });
    };

    this.load = function() {
      return $http({
        method: "get",
        url: oncallerUrl,
      }).then(function onSuccess(response) {
        for (var i = 0; i < response.data.length; i++) {
          var theoncallerDef = response.data[i];
          self.oncallerDefMap[theoncallerDef.name] = theoncallerDef;
        }
        return response;
      }, function onFailed(response) {
        oncallerSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 5000);
        return response;
      });
    };

    this.save = function(oncallerDef) {
      return $http({
        method: "post",
        url: oncallerUrl,
        data: angular.toJson(oncallerDef),
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.remove = function(oncallerService) {
      return $http({
        method: "delete",
        url: oncallerUrl,
        params: {service: oncallerService},
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.get = function(name) {
      return self.oncallerDefMap[name];
    };

    this.init();

  });
});
