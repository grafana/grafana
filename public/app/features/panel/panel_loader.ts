///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import config from 'app/core/config';

import {unknownPanelDirective} from '../../plugins/panel/unknown/module';

/** @ngInject */
function panelLoader($parse, dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    directive: scope => {
      let panelInfo = config.panels[scope.panel.type];
      if (!panelInfo) {
        return Promise.resolve({
          name: 'panel-directive-' + scope.panel.type,
          fn: unknownPanelDirective
        });
      }

      return System.import(panelInfo.module).then(function(panelModule) {
        return {
          name: 'panel-directive-' + scope.panel.type,
          fn: panelModule.panel,
        };
      });
    },
  });
}

angular.module('grafana.directives').directive('panelLoader', panelLoader);
