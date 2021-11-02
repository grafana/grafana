import { selectors } from '@grafana/e2e-selectors';
var AxesEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function AxesEditorCtrl($scope) {
        this.$scope = $scope;
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;
        this.$scope.ctrl = this;
        this.logScales = {
            linear: 1,
            'log (base 2)': 2,
            'log (base 10)': 10,
            'log (base 32)': 32,
            'log (base 1024)': 1024,
        };
        this.xAxisModes = {
            Time: 'time',
            Series: 'series',
            Histogram: 'histogram',
            // 'Data field': 'field',
        };
        this.xAxisStatOptions = [
            { text: 'Avg', value: 'avg' },
            { text: 'Min', value: 'min' },
            { text: 'Max', value: 'max' },
            { text: 'Total', value: 'total' },
            { text: 'Count', value: 'count' },
            { text: 'Current', value: 'current' },
        ];
        if (this.panel.xaxis.mode === 'custom') {
            if (!this.panel.xaxis.name) {
                this.panel.xaxis.name = 'specify field';
            }
        }
        this.selectors = selectors.components.Panels.Visualization.Graph.VisualizationTab;
    }
    AxesEditorCtrl.prototype.setUnitFormat = function (axis) {
        var _this = this;
        return function (unit) {
            axis.format = unit;
            // if already set via field config we clear that
            if (_this.panel.fieldConfig.defaults.unit) {
                _this.panel.fieldConfig.defaults.unit = undefined;
                _this.panelCtrl.refresh();
            }
            else {
                _this.panelCtrl.render();
            }
        };
    };
    AxesEditorCtrl.prototype.render = function () {
        this.panelCtrl.render();
    };
    AxesEditorCtrl.prototype.xAxisModeChanged = function () {
        this.panelCtrl.processor.setPanelDefaultsForNewXAxisMode();
        this.panelCtrl.onDataFramesReceived(this.panelCtrl.dataList);
    };
    AxesEditorCtrl.prototype.xAxisValueChanged = function () {
        this.panelCtrl.onDataFramesReceived(this.panelCtrl.dataList);
    };
    return AxesEditorCtrl;
}());
export { AxesEditorCtrl };
/** @ngInject */
export function axesEditorComponent() {
    'use strict';
    return {
        restrict: 'E',
        scope: true,
        templateUrl: 'public/app/plugins/panel/graph/axes_editor.html',
        controller: AxesEditorCtrl,
    };
}
//# sourceMappingURL=axes_editor.js.map