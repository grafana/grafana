///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

/** @ngInject */
function dsConfigView(dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    scope: {
      dsMeta: "=",
      current: "="
    },
    watchPath: "dsMeta.module",
    directive: scope => {
      return System.import(scope.dsMeta.module).then(function(dsModule) {
        return {
          name: 'ds-config-' + scope.dsMeta.id,
          fn: dsModule.configView,
        };
      });
    },
  });
}


angular.module('grafana.directives').directive('dsConfigView', dsConfigView);
