import angular from 'angular';
var directiveModule = angular.module('grafana.directives');
var directiveCache = {};
/** @ngInject */
function panelEditorTab(dynamicDirectiveSrv) {
    return dynamicDirectiveSrv.create({
        scope: {
            ctrl: '=',
            editorTab: '=',
        },
        directive: function (scope) {
            var pluginId = scope.ctrl.pluginId;
            var tabName = scope.editorTab.title
                .toLowerCase()
                .replace(' ', '-')
                .replace('&', '')
                .replace(' ', '')
                .replace(' ', '-');
            if (directiveCache[pluginId]) {
                if (directiveCache[pluginId][tabName]) {
                    return directiveCache[pluginId][tabName];
                }
            }
            else {
                directiveCache[pluginId] = [];
            }
            var result = {
                fn: function () { return scope.editorTab.directiveFn(); },
                name: "panel-editor-tab-" + pluginId + tabName,
            };
            directiveCache[pluginId][tabName] = result;
            return result;
        },
    });
}
directiveModule.directive('panelEditorTab', panelEditorTab);
//# sourceMappingURL=panel_editor_tab.js.map