///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

/** @ngInject */
function appConfigView(dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    scope: {
      appModel: "="
    },
    directive: scope => {
      return System.import(scope.appModel.module).then(function(appModule) {
        return {
          name: 'app-config-' + scope.appModel.appId,
          fn: appModule.configView,
        };
      });
    },
  });
}


angular.module('grafana.directives').directive('appConfigView', appConfigView);
