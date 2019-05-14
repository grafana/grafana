var HeatmapDisplayEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function HeatmapDisplayEditorCtrl($scope) {
        $scope.editor = this;
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;
        this.panelCtrl.render();
    }
    return HeatmapDisplayEditorCtrl;
}());
export { HeatmapDisplayEditorCtrl };
/** @ngInject */
export function heatmapDisplayEditor() {
    'use strict';
    return {
        restrict: 'E',
        scope: true,
        templateUrl: 'public/app/plugins/panel/heatmap/partials/display_editor.html',
        controller: HeatmapDisplayEditorCtrl,
    };
}
//# sourceMappingURL=display_editor.js.map