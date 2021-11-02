import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendStatsList } from './VizLegendStatsList';
import { useStyles } from '../../themes';
import { selectors } from '@grafana/e2e-selectors';
/**
 * @internal
 */
export var VizLegendListItem = function (_a) {
    var item = _a.item, onLabelClick = _a.onLabelClick, onLabelMouseEnter = _a.onLabelMouseEnter, onLabelMouseOut = _a.onLabelMouseOut, className = _a.className, readonly = _a.readonly;
    var styles = useStyles(getStyles);
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
    return (React.createElement("div", { className: cx(styles.itemWrapper, className), "aria-label": selectors.components.VizLegend.seriesName(item.label) },
        React.createElement(VizLegendSeriesIcon, { seriesName: item.label, color: item.color, gradient: item.gradient, readonly: readonly }),
        React.createElement("div", { onMouseEnter: onMouseEnter, onMouseOut: onMouseOut, onClick: !readonly ? onClick : undefined, className: cx(styles.label, item.disabled && styles.labelDisabled, !readonly && styles.clickable) }, item.label),
        item.getDisplayValues && React.createElement(VizLegendStatsList, { stats: item.getDisplayValues() })));
};
VizLegendListItem.displayName = 'VizLegendListItem';
var getStyles = function (theme) { return ({
    label: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: LegendLabel;\n    white-space: nowrap;\n  "], ["\n    label: LegendLabel;\n    white-space: nowrap;\n  "]))),
    clickable: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: LegendClickabel;\n    cursor: pointer;\n  "], ["\n    label: LegendClickabel;\n    cursor: pointer;\n  "]))),
    labelDisabled: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    label: LegendLabelDisabled;\n    color: ", ";\n  "], ["\n    label: LegendLabelDisabled;\n    color: ", ";\n  "])), theme.colors.linkDisabled),
    itemWrapper: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    label: LegendItemWrapper;\n    display: flex;\n    white-space: nowrap;\n    align-items: center;\n    flex-grow: 1;\n  "], ["\n    label: LegendItemWrapper;\n    display: flex;\n    white-space: nowrap;\n    align-items: center;\n    flex-grow: 1;\n  "]))),
    value: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    text-align: right;\n  "], ["\n    text-align: right;\n  "]))),
    yAxisLabel: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.gray2),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=VizLegendListItem.js.map