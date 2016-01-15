///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

/** @ngInject */
function metricsQueryEditor(dynamicDirectiveSrv, datasourceSrv) {
  return dynamicDirectiveSrv.create({
    watchPath: "panel.datasource",
    directive: scope => {
      let datasource = scope.target.datasource || scope.panel.datasource;
      return datasourceSrv.get(datasource).then(ds => {
        scope.datasource = ds;

        if (!scope.target.refId) {
          scope.target.refId = 'A';
        }

        return System.import(ds.meta.module).then(dsModule => {
          return {
            name: 'metrics-query-editor-' + ds.meta.id,
            fn: dsModule.metricsQueryEditor,
          };
        });
      });
    }
  });
}

/** @ngInject */
function metricsQueryOptions(dynamicDirectiveSrv, datasourceSrv) {
  return dynamicDirectiveSrv.create({
    watchPath: "panel.datasource",
    directive: scope => {
      return datasourceSrv.get(scope.panel.datasource).then(ds => {
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

angular.module('grafana.directives')
  .directive('metricsQueryEditor', metricsQueryEditor)
  .directive('metricsQueryOptions', metricsQueryOptions);
