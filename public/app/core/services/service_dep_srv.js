define([
  'angular',
  'lodash',
  '../core_module',
  'app/core/config',
],
  function (angular, _, coreModule, config) {
    'use strict';

    coreModule.service('serviceDepSrv', function($http, alertSrv, $timeout,backendSrv, $q) {
      var self = this;

      this.readInstalledService = function () {
        return backendSrv.alertD({
          url: "/cmdb/service"
        });
      };

      this.createServiceDependency = function (graph) {
        return backendSrv.alertD({
          method: "post",
          url: "/cmdb/service/depend",
          data: graph,
          headers: {'Content-Type': 'text/plain'}
        });
      };

      this.updateServiceDependency = function (graph, updateId, graphId) {
        return backendSrv.alertD({
          method: "PUT",
          url: "/cmdb/service/depend?id=" + updateId + "&aid=" + graphId,
          data: graph,
          headers: {'Content-Type': 'text/plain'}
        });
      };

      this.readServiceDependency = function () {
        return backendSrv.alertD({
          url: "/cmdb/service/depend"
        });
      };

      this.readServiceStatus = function (serviceId, serviceName) {
        return backendSrv.alertD({
          url: "/service/status?hostStatusIncluded=false&service=" + serviceName + "&serviceId=" + serviceId
        });
      };

      this.readHostStatus = function (serviceId, serviceName) {
        return backendSrv.alertD({
          url: "/service/status?healthItemType=ServiceState&service=" + serviceName + "&serviceId=" + serviceId
        });
      };
      
      this.readMetricStatus = function (serviceId, serviceName, host) {
        return backendSrv.alertD({
          url: "/service/status?service=" + serviceName + "&serviceId=" + serviceId
        });
      };

    });
  }
)