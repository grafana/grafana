import kbn from 'app/core/utils/kbn';
var AxesEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function AxesEditorCtrl($scope, uiSegmentSrv) {
        $scope.editor = this;
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;
        this.unitFormats = kbn.getUnitFormats();
        this.logScales = {
            linear: 1,
            'log (base 2)': 2,
            'log (base 10)': 10,
            'log (base 32)': 32,
            'log (base 1024)': 1024,
        };
        this.dataFormats = {
            'Time series': 'timeseries',
            'Time series buckets': 'tsbuckets',
        };
        this.yBucketBoundModes = {
            Auto: 'auto',
            Upper: 'upper',
            Lower: 'lower',
            Middle: 'middle',
        };
    }
    AxesEditorCtrl.prototype.setUnitFormat = function (subItem) {
        this.panel.yAxis.format = subItem.value;
        this.panelCtrl.render();
    };
    return AxesEditorCtrl;
}());
export { AxesEditorCtrl };
/** @ngInject */
export function axesEditor() {
    'use strict';
    return {
        restrict: 'E',
        scope: true,
        templateUrl: 'public/app/plugins/panel/heatmap/partials/axes_editor.html',
        controller: AxesEditorCtrl,
    };
}
//# sourceMappingURL=axes_editor.js.map