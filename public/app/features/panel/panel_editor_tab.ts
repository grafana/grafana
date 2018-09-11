import angular from 'angular';

const directiveModule = angular.module('grafana.directives');

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
      // create a wrapper for directiveFn
      // required for metrics tab directive
      // that is the same for many panels but
      // given different names in this function
      const fn = () => scope.editorTab.directiveFn();

      return Promise.resolve({
        name: `panel-editor-tab-${pluginId}${tabIndex}`,
        fn: fn,
      });
    },
  });
}

directiveModule.directive('panelEditorTab', panelEditorTab);
