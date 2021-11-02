import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { SeriesIcon } from '../VizLegend/SeriesIcon';
import { useStyles2 } from '../../themes';
var getSeriesTableRowStyles = function (theme) {
    return {
        icon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: ", ";\n      vertical-align: middle;\n    "], ["\n      margin-right: ", ";\n      vertical-align: middle;\n    "])), theme.spacing(1)),
        seriesTable: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: table;\n    "], ["\n      display: table;\n    "]))),
        seriesTableRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: table-row;\n      font-size: ", ";\n    "], ["\n      display: table-row;\n      font-size: ", ";\n    "])), theme.typography.bodySmall.fontSize),
        seriesTableCell: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: table-cell;\n    "], ["\n      display: table-cell;\n    "]))),
        label: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      word-break: break-all;\n    "], ["\n      word-break: break-all;\n    "]))),
        value: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      padding-left: ", ";\n    "], ["\n      padding-left: ", ";\n    "])), theme.spacing(2)),
        activeSeries: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      font-weight: ", ";\n      color: ", ";\n    "], ["\n      font-weight: ", ";\n      color: ", ";\n    "])), theme.typography.fontWeightBold, theme.colors.text.maxContrast),
        timestamp: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      font-weight: ", ";\n      font-size: ", ";\n    "], ["\n      font-weight: ", ";\n      font-size: ", ";\n    "])), theme.typography.fontWeightBold, theme.typography.bodySmall.fontSize),
    };
};
/**
 * @public
 */
export var SeriesTableRow = function (_a) {
    var color = _a.color, label = _a.label, value = _a.value, isActive = _a.isActive;
    var styles = useStyles2(getSeriesTableRowStyles);
    return (React.createElement("div", { className: cx(styles.seriesTableRow, isActive && styles.activeSeries) },
        color && (React.createElement("div", { className: styles.seriesTableCell },
            React.createElement(SeriesIcon, { color: color, className: styles.icon }))),
        label && React.createElement("div", { className: cx(styles.seriesTableCell, styles.label) }, label),
        value && React.createElement("div", { className: cx(styles.seriesTableCell, styles.value) }, value)));
};
/**
 * @public
 */
export var SeriesTable = function (_a) {
    var timestamp = _a.timestamp, series = _a.series;
    var styles = useStyles2(getSeriesTableRowStyles);
    return (React.createElement(React.Fragment, null,
        timestamp && (React.createElement("div", { className: styles.timestamp, "aria-label": "Timestamp" }, timestamp)),
        series.map(function (s, i) {
            return (React.createElement(SeriesTableRow, { isActive: s.isActive, label: s.label, color: s.color, value: s.value, key: s.label + "-" + i }));
        })));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=SeriesTable.js.map