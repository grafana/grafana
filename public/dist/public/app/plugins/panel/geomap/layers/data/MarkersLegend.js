import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Label, stylesFactory, useTheme2 } from '@grafana/ui';
import { formattedValueToString, getFieldColorModeForField } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { getThresholdItems } from 'app/plugins/panel/state-timeline/utils';
import { getMinMaxAndDelta } from '../../../../../../../packages/grafana-data/src/field/scale';
export function MarkersLegend(props) {
    var _a, _b, _c;
    var color = props.color;
    var theme = useTheme2();
    if (!color || (!color.field && color.fixed)) {
        return React.createElement(React.Fragment, null);
    }
    var style = getStyles(theme);
    var fmt = function (v) { return "" + formattedValueToString(color.field.display(v)); };
    var colorMode = getFieldColorModeForField(color.field);
    if (colorMode.isContinuous && colorMode.getColors) {
        var colors = colorMode.getColors(config.theme2);
        var colorRange = getMinMaxAndDelta(color.field);
        // TODO: explore showing mean on the gradiant scale
        // const stats = reduceField({
        //   field: color.field!,
        //   reducers: [
        //     ReducerID.min,
        //     ReducerID.max,
        //     ReducerID.mean,
        //     // std dev?
        //   ]
        // })
        return (React.createElement(React.Fragment, null,
            React.createElement(Label, null, (_a = color === null || color === void 0 ? void 0 : color.field) === null || _a === void 0 ? void 0 : _a.name),
            React.createElement("div", { className: style.gradientContainer, style: { backgroundImage: "linear-gradient(to right, " + colors.map(function (c) { return c; }).join(', ') } },
                React.createElement("div", { style: { color: theme.colors.getContrastText(colors[0]) } }, fmt(colorRange.min)),
                React.createElement("div", { style: { color: theme.colors.getContrastText(colors[colors.length - 1]) } }, fmt(colorRange.max)))));
    }
    var thresholds = (_c = (_b = color.field) === null || _b === void 0 ? void 0 : _b.config) === null || _c === void 0 ? void 0 : _c.thresholds;
    if (!thresholds || thresholds.steps.length < 2) {
        return React.createElement("div", null); // don't show anything in the legend
    }
    var items = getThresholdItems(color.field.config, config.theme2);
    return (React.createElement("div", { className: style.infoWrap },
        React.createElement("div", { className: style.legend }, items.map(function (item, idx) { return (React.createElement("div", { key: idx + "/" + item.label, className: style.legendItem },
            React.createElement("i", { style: { background: item.color } }),
            item.label)); }))));
}
var getStyles = stylesFactory(function (theme) { return ({
    infoWrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background: ", ";\n    border-radius: 2px;\n    padding: ", ";\n  "], ["\n    background: ", ";\n    border-radius: 2px;\n    padding: ", ";\n  "])), theme.colors.background.secondary, theme.spacing(1)),
    legend: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    line-height: 18px;\n    display: flex;\n    flex-direction: column;\n    font-size: ", ";\n\n    i {\n      width: 18px;\n      height: 18px;\n      float: left;\n      margin-right: 8px;\n      opacity: 0.7;\n    }\n  "], ["\n    line-height: 18px;\n    display: flex;\n    flex-direction: column;\n    font-size: ", ";\n\n    i {\n      width: 18px;\n      height: 18px;\n      float: left;\n      margin-right: 8px;\n      opacity: 0.7;\n    }\n  "])), theme.typography.bodySmall.fontSize),
    legendItem: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    white-space: nowrap;\n  "], ["\n    white-space: nowrap;\n  "]))),
    gradientContainer: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    min-width: 200px;\n    display: flex;\n    justify-content: space-between;\n    font-size: ", ";\n    padding: ", ";\n  "], ["\n    min-width: 200px;\n    display: flex;\n    justify-content: space-between;\n    font-size: ", ";\n    padding: ", ";\n  "])), theme.typography.bodySmall.fontSize, theme.spacing(0, 0.5)),
}); });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=MarkersLegend.js.map