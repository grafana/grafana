import { find, map, without } from 'lodash';
import { transformers } from './transformers';
var TablePanelEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function TablePanelEditorCtrl($scope, uiSegmentSrv) {
        this.uiSegmentSrv = uiSegmentSrv;
        this.canSetColumns = false;
        this.columnsHelpMessage = '';
        $scope.editor = this;
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;
        this.transformers = transformers;
        this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
        this.addColumnSegment = uiSegmentSrv.newPlusButton();
        this.updateTransformHints();
    }
    TablePanelEditorCtrl.prototype.updateTransformHints = function () {
        this.canSetColumns = false;
        this.columnsHelpMessage = '';
        switch (this.panel.transform) {
            case 'timeseries_aggregations': {
                this.canSetColumns = true;
                break;
            }
            case 'json': {
                this.canSetColumns = true;
                break;
            }
            case 'table': {
                this.columnsHelpMessage = 'Columns and their order are determined by the data query';
            }
        }
    };
    TablePanelEditorCtrl.prototype.getColumnOptions = function () {
        var _this = this;
        if (!this.panelCtrl.dataRaw) {
            return Promise.resolve([]);
        }
        var columns = this.transformers[this.panel.transform].getColumns(this.panelCtrl.dataRaw);
        var segments = map(columns, function (c) { return _this.uiSegmentSrv.newSegment({ value: c.text }); });
        return Promise.resolve(segments);
    };
    TablePanelEditorCtrl.prototype.addColumn = function () {
        var columns = transformers[this.panel.transform].getColumns(this.panelCtrl.dataRaw);
        var column = find(columns, { text: this.addColumnSegment.value });
        if (column) {
            this.panel.columns.push(column);
            this.render();
        }
        var plusButton = this.uiSegmentSrv.newPlusButton();
        this.addColumnSegment.html = plusButton.html;
        this.addColumnSegment.value = plusButton.value;
    };
    TablePanelEditorCtrl.prototype.transformChanged = function () {
        this.panel.columns = [];
        if (this.panel.transform === 'annotations') {
            this.panelCtrl.refresh();
        }
        else {
            if (this.panel.transform === 'timeseries_aggregations') {
                this.panel.columns.push({ text: 'Avg', value: 'avg' });
            }
            this.updateTransformHints();
            this.render();
        }
    };
    TablePanelEditorCtrl.prototype.render = function () {
        this.panelCtrl.render();
    };
    TablePanelEditorCtrl.prototype.removeColumn = function (column) {
        this.panel.columns = without(this.panel.columns, column);
        this.panelCtrl.render();
    };
    return TablePanelEditorCtrl;
}());
export { TablePanelEditorCtrl };
export function tablePanelEditor(uiSegmentSrv) {
    'use strict';
    return {
        restrict: 'E',
        scope: true,
        templateUrl: 'public/app/plugins/panel/table-old/editor.html',
        controller: TablePanelEditorCtrl,
    };
}
//# sourceMappingURL=editor.js.map