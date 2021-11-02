import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { useStyles2 } from '../../themes/ThemeContext';
import { styleMixins } from '../../themes';
import { formattedValueToString } from '@grafana/data';
/**
 * @internal
 */
export var LegendTableItem = function (_a) {
    var item = _a.item, onLabelClick = _a.onLabelClick, onLabelMouseEnter = _a.onLabelMouseEnter, onLabelMouseOut = _a.onLabelMouseOut, className = _a.className, readonly = _a.readonly;
    var styles = useStyles2(getStyles);
    var onMouseEnter = useCallback(function (event) {
        if (onLabelMouseEnter) {
            onLabelMouseEnter(item, event);
        }
    }, [item, onLabelMouseEnter]);
    var onMouseOut = useCallback(function (event) {
        if (onLabelMouseOut) {
            onLabelMouseOut(item, event);
        }
    }, [item, onLabelMouseOut]);
    var onClick = useCallback(function (event) {
        if (onLabelClick) {
            onLabelClick(item, event);
        }
    }, [item, onLabelClick]);
    return (React.createElement("tr", { className: cx(styles.row, className) },
        React.createElement("td", null,
            React.createElement("span", { className: styles.itemWrapper },
                React.createElement(VizLegendSeriesIcon, { color: item.color, seriesName: item.label, readonly: readonly }),
                React.createElement("div", { onMouseEnter: onMouseEnter, onMouseOut: onMouseOut, onClick: !readonly ? onClick : undefined, className: cx(styles.label, item.disabled && styles.labelDisabled, !readonly && styles.clickable) },
                    item.label,
                    " ",
                    item.yAxis === 2 && React.createElement("span", { className: styles.yAxisLabel }, "(right y-axis)")))),
        item.getDisplayValues &&
            item.getDisplayValues().map(function (stat, index) {
                return (React.createElement("td", { className: styles.value, key: stat.title + "-" + index }, formattedValueToString(stat)));
            })));
};
LegendTableItem.displayName = 'LegendTableItem';
var getStyles = function (theme) {
    var rowHoverBg = styleMixins.hoverColor(theme.colors.background.primary, theme);
    return {
        row: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: LegendRow;\n      font-size: ", ";\n      border-bottom: 1px solid ", ";\n      td {\n        padding: ", ";\n        white-space: nowrap;\n      }\n\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      label: LegendRow;\n      font-size: ", ";\n      border-bottom: 1px solid ", ";\n      td {\n        padding: ", ";\n        white-space: nowrap;\n      }\n\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.v1.typography.size.sm, theme.colors.border.weak, theme.spacing(0.25, 1), rowHoverBg),
        label: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: LegendLabel;\n      white-space: nowrap;\n    "], ["\n      label: LegendLabel;\n      white-space: nowrap;\n    "]))),
        labelDisabled: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: LegendLabelDisabled;\n      color: ", ";\n    "], ["\n      label: LegendLabelDisabled;\n      color: ", ";\n    "])), theme.colors.text.disabled),
        clickable: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: LegendClickable;\n      cursor: pointer;\n    "], ["\n      label: LegendClickable;\n      cursor: pointer;\n    "]))),
        itemWrapper: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      white-space: nowrap;\n      align-items: center;\n    "], ["\n      display: flex;\n      white-space: nowrap;\n      align-items: center;\n    "]))),
        value: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      text-align: left;\n    "], ["\n      text-align: left;\n    "]))),
        yAxisLabel: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.secondary),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=VizLegendTableItem.js.map