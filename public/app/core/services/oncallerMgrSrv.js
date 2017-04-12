define([
    'angular',
    'lodash',
    '../core_module',
],
function (angular, _, coreModule) {
  'use strict';
  coreModule.service('oncallerMgrSrv', function($http, alertSrv, backendSrv, contextSrv) {
    this.oncallerDefMap = {};
    var self = this;
    var oncallerUrl = "/oncaller/definition";

    this.load = function() {
      return backendSrv.alertD({
        method: "get",
        url: oncallerUrl,
      }).then(function onSuccess(response) {
        for (var i = 0; i < response.data.length; i++) {
          var theoncallerDef = response.data[i];
          self.oncallerDefMap[theoncallerDef.org + ":" + theoncallerDef.service] = theoncallerDef;
        }
        return response;
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 5000);
        return response;
      });
    };

    this.save = function(oncallerDef) {
      oncallerDef.org = contextSrv.user.orgId;
      return backendSrv.alertD({
        method: "post",
        url: oncallerUrl,
        data: angular.toJson(oncallerDef),
        headers: {'Content-Type': 'text/plain'},
      });
    };

    this.remove = function(oncallerOrg, oncallerService, oncallerId) {
      return backendSrv.alertD({
        method: "delete",
        url: oncallerUrl,
        params: {org: oncallerOrg, service: oncallerService, id:oncallerId},
        headers: {'Content-Type': 'text/plain'},
      });
    };

    //id is in the form of org:service
    this.get = function(id) {
      return self.oncallerDefMap[id];
    };

  });
});
