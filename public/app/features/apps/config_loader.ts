///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

/** @ngInject */
function appConfigLoader(dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    scope: {
      appModel: "="
    },
    directive: scope => {
      return System.import(scope.appModel.module).then(function(appModule) {
        return {
          name: 'appConfigLoader' + scope.appModel.appId,
          fn: scope.appModel.directives.configView,
        };
      });
    },
  });
}


angular.module('grafana.directives').directive('appConfigLoader', appConfigLoader);
