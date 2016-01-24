///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import config from 'app/core/config';

var directiveModule = angular.module('grafana.directives');

/** @ngInject */
function panelEditorTab(dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    scope: {
      panelCtrl: "=",
      editorTab: "=",
    },
    directive: scope => {
      return Promise.resolve({
        name: 'panel-editor-tab-' + scope.editorTab.title,
        fn: scope.editorTab.directiveFn,
      });
    }
  });
}

directiveModule.directive('panelEditorTab', panelEditorTab);
