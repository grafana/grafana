import _ from 'lodash';
import { getValueFormats } from '@grafana/ui';
var ColumnOptionsCtrl = /** @class */ (function () {
    /** @ngInject */
    function ColumnOptionsCtrl($scope) {
        var _this = this;
        $scope.editor = this;
        this.activeStyleIndex = 0;
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;
        this.unitFormats = getValueFormats();
        this.colorModes = [
            { text: 'Disabled', value: null },
            { text: 'Cell', value: 'cell' },
            { text: 'Value', value: 'value' },
            { text: 'Row', value: 'row' },
        ];
        this.columnTypes = [
            { text: 'Number', value: 'number' },
            { text: 'String', value: 'string' },
            { text: 'Date', value: 'date' },
            { text: 'Hidden', value: 'hidden' },
        ];
        this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
        this.dateFormats = [
            { text: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' },
            { text: 'YYYY-MM-DD HH:mm:ss.SSS', value: 'YYYY-MM-DD HH:mm:ss.SSS' },
            { text: 'MM/DD/YY h:mm:ss a', value: 'MM/DD/YY h:mm:ss a' },
            { text: 'MMMM D, YYYY LT', value: 'MMMM D, YYYY LT' },
            { text: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
        ];
        this.mappingTypes = [{ text: 'Value to text', value: 1 }, { text: 'Range to text', value: 2 }];
        this.getColumnNames = function () {
            if (!_this.panelCtrl.table) {
                return [];
            }
            return _.map(_this.panelCtrl.table.columns, function (col) {
                return col.text;
            });
        };
        this.onColorChange = this.onColorChange.bind(this);
    }
    ColumnOptionsCtrl.prototype.render = function () {
        this.panelCtrl.render();
    };
    ColumnOptionsCtrl.prototype.setUnitFormat = function (column, subItem) {
        column.unit = subItem.value;
        this.panelCtrl.render();
    };
    ColumnOptionsCtrl.prototype.addColumnStyle = function () {
        var newStyleRule = {
            unit: 'short',
            type: 'number',
            alias: '',
            decimals: 2,
            colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
            colorMode: null,
            pattern: '',
            dateFormat: 'YYYY-MM-DD HH:mm:ss',
            thresholds: [],
            mappingType: 1,
        };
        var styles = this.panel.styles;
        var stylesCount = styles.length;
        var indexToInsert = stylesCount;
        // check if last is a catch all rule, then add it before that one
        if (stylesCount > 0) {
            var last = styles[stylesCount - 1];
            if (last.pattern === '/.*/') {
                indexToInsert = stylesCount - 1;
            }
        }
        styles.splice(indexToInsert, 0, newStyleRule);
        this.activeStyleIndex = indexToInsert;
    };
    ColumnOptionsCtrl.prototype.removeColumnStyle = function (style) {
        this.panel.styles = _.without(this.panel.styles, style);
    };
    ColumnOptionsCtrl.prototype.invertColorOrder = function (index) {
        var ref = this.panel.styles[index].colors;
        var copy = ref[0];
        ref[0] = ref[2];
        ref[2] = copy;
        this.panelCtrl.render();
    };
    ColumnOptionsCtrl.prototype.onColorChange = function (styleIndex, colorIndex) {
        var _this = this;
        return function (newColor) {
            _this.panel.styles[styleIndex].colors[colorIndex] = newColor;
            _this.render();
        };
    };
    ColumnOptionsCtrl.prototype.addValueMap = function (style) {
        if (!style.valueMaps) {
            style.valueMaps = [];
        }
        style.valueMaps.push({ value: '', text: '' });
        this.panelCtrl.render();
    };
    ColumnOptionsCtrl.prototype.removeValueMap = function (style, index) {
        style.valueMaps.splice(index, 1);
        this.panelCtrl.render();
    };
    ColumnOptionsCtrl.prototype.addRangeMap = function (style) {
        if (!style.rangeMaps) {
            style.rangeMaps = [];
        }
        style.rangeMaps.push({ from: '', to: '', text: '' });
        this.panelCtrl.render();
    };
    ColumnOptionsCtrl.prototype.removeRangeMap = function (style, index) {
        style.rangeMaps.splice(index, 1);
        this.panelCtrl.render();
    };
    return ColumnOptionsCtrl;
}());
export { ColumnOptionsCtrl };
/** @ngInject */
export function columnOptionsTab($q, uiSegmentSrv) {
    'use strict';
    return {
        restrict: 'E',
        scope: true,
        templateUrl: 'public/app/plugins/panel/table/column_options.html',
        controller: ColumnOptionsCtrl,
    };
}
//# sourceMappingURL=column_options.js.map