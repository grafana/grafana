///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

var directivesModule = angular.module('grafana.directives');

/** @ngInject */
function metricsQueryOptions(dynamicDirectiveSrv, datasourceSrv) {
  return dynamicDirectiveSrv.create({
    watchPath: "ctrl.panel.datasource",
    directive: scope => {
      return datasourceSrv.get(scope.ctrl.panel.datasource).then(ds => {
        return System.import(ds.meta.module).then(dsModule => {
          return {
            name: 'metrics-query-options-' + ds.meta.id,
            fn: dsModule.metricsQueryOptions
          };
        });
      });
    }
  });
}

directivesModule.directive('metricsQueryOptions', metricsQueryOptions);
