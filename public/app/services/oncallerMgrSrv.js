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
    var oncallerUrl = "";

    this.init = function() {
      backendSrv.get('/api/oncallersource').then(function(result) {
        oncallerUrl = result.oncaller.oncaller_url;
      });
    };

    this.load = function() {
      return $http({
        method: "get",
        url: oncallerUrl,
      }).then(function onSuccess(response) {
        for (var i = 0; i < response.data.length; i++) {
          var theoncallerDef = response.data[i];
          self.oncallerDefMap[theoncallerDef.id] = theoncallerDef;
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

    this.remove = function(oncallerId) {
      return $http({
        method: "delete",
        url: oncallerUrl,
        params: {id: oncallerId},
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.get = function(id) {
      return self.oncallerDefMap[id];
    };

    this.init();

  });
});
