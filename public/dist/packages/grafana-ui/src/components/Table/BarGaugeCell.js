import { __assign } from "tslib";
import React from 'react';
import { ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGauge, BarGaugeDisplayMode } from '../BarGauge/BarGauge';
import { TableCellDisplayMode } from './types';
var defaultScale = {
    mode: ThresholdsMode.Absolute,
    steps: [
        {
            color: 'blue',
            value: -Infinity,
        },
        {
            color: 'green',
            value: 20,
        },
    ],
};
export var BarGaugeCell = function (props) {
    var field = props.field, innerWidth = props.innerWidth, tableStyles = props.tableStyles, cell = props.cell, cellProps = props.cellProps;
    var config = getFieldConfigWithMinMax(field, false);
    if (!config.thresholds) {
        config = __assign(__assign({}, config), { thresholds: defaultScale });
    }
    var displayValue = field.display(cell.value);
    var barGaugeMode = BarGaugeDisplayMode.Gradient;
    if (field.config.custom && field.config.custom.displayMode === TableCellDisplayMode.LcdGauge) {
        barGaugeMode = BarGaugeDisplayMode.Lcd;
    }
    else if (field.config.custom && field.config.custom.displayMode === TableCellDisplayMode.BasicGauge) {
        barGaugeMode = BarGaugeDisplayMode.Basic;
    }
    return (React.createElement("div", __assign({}, cellProps, { className: tableStyles.cellContainer }),
        React.createElement(BarGauge, { width: innerWidth, height: tableStyles.cellHeightInner, field: config, display: field.display, text: { valueSize: 14 }, value: displayValue, orientation: VizOrientation.Horizontal, theme: tableStyles.theme, itemSpacing: 1, lcdCellWidth: 8, displayMode: barGaugeMode })));
};
//# sourceMappingURL=BarGaugeCell.js.map