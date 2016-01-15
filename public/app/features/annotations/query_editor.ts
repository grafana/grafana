///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

/** @ngInject */
function annotationsQueryEditor(dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    scope: {
      annotation: "=",
      datasource: "="
    },
    watchPath: "datasource.type",
    directive: scope => {
      return System.import(scope.datasource.meta.module).then(function(dsModule) {
        return {
          name: 'annotation-query-editor-' + scope.datasource.meta.id,
          fn: dsModule.annotationsQueryEditor,
        };
      });
    },
  });
}


angular.module('grafana.directives').directive('annotationsQueryEditor', annotationsQueryEditor);
