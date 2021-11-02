import { __assign } from "tslib";
import React from 'react';
import { formattedValueToString } from '@grafana/data';
import { TableCellDisplayMode } from './types';
import tinycolor from 'tinycolor2';
import { FilterActions } from './FilterActions';
import { getTextColorForBackground, getCellLinks } from '../../utils';
export var DefaultCell = function (props) {
    var field = props.field, cell = props.cell, tableStyles = props.tableStyles, row = props.row, cellProps = props.cellProps;
    var displayValue = field.display(cell.value);
    var value;
    if (React.isValidElement(cell.value)) {
        value = cell.value;
    }
    else {
        value = formattedValueToString(displayValue);
    }
    var cellStyle = getCellStyle(tableStyles, field, displayValue);
    var showFilters = field.config.filterable;
    var _a = getCellLinks(field, row), link = _a.link, onClick = _a.onClick;
    return (React.createElement("div", __assign({}, cellProps, { className: cellStyle }),
        !link && React.createElement("div", { className: tableStyles.cellText }, value),
        link && (React.createElement("a", { href: link.href, onClick: onClick, target: link.target, title: link.title, className: tableStyles.cellLink }, value)),
        showFilters && cell.value !== undefined && React.createElement(FilterActions, __assign({}, props))));
};
function getCellStyle(tableStyles, field, displayValue) {
    var _a, _b, _c;
    if (((_a = field.config.custom) === null || _a === void 0 ? void 0 : _a.displayMode) === TableCellDisplayMode.ColorText) {
        return tableStyles.buildCellContainerStyle(displayValue.color);
    }
    if (((_b = field.config.custom) === null || _b === void 0 ? void 0 : _b.displayMode) === TableCellDisplayMode.ColorBackgroundSolid) {
        var bgColor = tinycolor(displayValue.color);
        var textColor = getTextColorForBackground(displayValue.color);
        return tableStyles.buildCellContainerStyle(textColor, bgColor.toRgbString());
    }
    if (((_c = field.config.custom) === null || _c === void 0 ? void 0 : _c.displayMode) === TableCellDisplayMode.ColorBackground) {
        var themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
        var bgColor2 = tinycolor(displayValue.color)
            .darken(10 * themeFactor)
            .spin(5)
            .toRgbString();
        var textColor = getTextColorForBackground(displayValue.color);
        return tableStyles.buildCellContainerStyle(textColor, "linear-gradient(120deg, " + bgColor2 + ", " + displayValue.color + ")");
    }
    return tableStyles.cellContainer;
}
//# sourceMappingURL=DefaultCell.js.map