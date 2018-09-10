import angular from 'angular';

const directiveModule = angular.module('grafana.directives');
const directiveCache = {};

/** @ngInject */
function panelEditorTab(dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    scope: {
      ctrl: '=',
      editorTab: '=',
      index: '=',
    },
    directive: scope => {
      const pluginId = scope.ctrl.pluginId;
      const tabIndex = scope.index;

      if (directiveCache[pluginId]) {
        if (directiveCache[pluginId][tabIndex]) {
          return directiveCache[pluginId][tabIndex];
        }
      } else {
        directiveCache[pluginId] = [];
      }

      const result = {
        fn: () => scope.editorTab.directiveFn(),
        name: `panel-editor-tab-${pluginId}${tabIndex}`,
      };

      directiveCache[pluginId][tabIndex] = result;

      return result;
    },
  });
}

directiveModule.directive('panelEditorTab', panelEditorTab);
