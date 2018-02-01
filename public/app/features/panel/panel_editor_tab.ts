import angular from 'angular';

var directiveModule = angular.module('grafana.directives');

/** @ngInject */
function panelEditorTab(dynamicDirectiveSrv) {
  return dynamicDirectiveSrv.create({
    scope: {
      ctrl: '=',
      editorTab: '=',
      index: '=',
    },
    directive: scope => {
      var pluginId = scope.ctrl.pluginId;
      var tabIndex = scope.index;
      // create a wrapper for directiveFn
      // required for metrics tab directive
      // that is the same for many panels but
      // given different names in this function
      var fn = () => scope.editorTab.directiveFn();

      return Promise.resolve({
        name: `panel-editor-tab-${pluginId}${tabIndex}`,
        fn: fn,
      });
    },
  });
}

directiveModule.directive('panelEditorTab', panelEditorTab);
