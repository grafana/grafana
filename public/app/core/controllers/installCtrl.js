define([
    'angular',
    'lodash',
    '../core_module',
],
function (angular, _,coreModule) {
    'use strict';

    coreModule.default.controller('InstallCtrl', function ($scope, backendSrv, datasourceSrv, contextSrv) {
      $scope.installSelect = {
        system: 0,
        service: ""
      };
      //would be hard code for a while
      $scope.services = ["Hadoop", "zookeeper", "JMX", "Mysql"];
      $scope.platform = ["Window", "Linux"];
      $scope.orgId = contextSrv.user.orgId;
      $scope.alertServer = backendSrv.alertDUrl;
      datasourceSrv.get("opentsdb").then(function (ds) {
        var url = document.createElement('a');
        url.href = ds.url;
        $scope.metricsServer = url.hostname;
      });
      $scope.changeToken = function () {
        _.each(backendSrv.tokens, function (token) {
          if (token.name === $scope.installSelect.system) {
            $scope.token = token.key;
          }
        });
      };
    });

  });
