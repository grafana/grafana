///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import config from 'app/core/config';

/** @ngInject */
function panelLoader($parse, dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    directive: scope => {
      let modulePath = config.panels[scope.panel.type].module;

      return System.import(modulePath).then(function(panelModule) {
        return {
          name: 'panel-directive-' + scope.panel.type,
          fn: panelModule.panel,
        };
      });
    },
  });
}

angular.module('grafana.directives').directive('panelLoader', panelLoader);
