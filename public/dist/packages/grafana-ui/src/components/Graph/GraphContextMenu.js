import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { getValueFromDimension, dateTimeFormat, } from '@grafana/data';
import { useTheme } from '../../themes';
import { HorizontalGroup } from '../Layout/Layout';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';
import { SeriesIcon } from '../VizLegend/SeriesIcon';
import { css } from '@emotion/css';
import { MenuGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';
/** @internal */
export var GraphContextMenu = function (_a) {
    var getContextMenuSource = _a.getContextMenuSource, timeZone = _a.timeZone, itemsGroup = _a.itemsGroup, dimensions = _a.dimensions, contextDimensions = _a.contextDimensions, otherProps = __rest(_a, ["getContextMenuSource", "timeZone", "itemsGroup", "dimensions", "contextDimensions"]);
    var source = getContextMenuSource();
    //  Do not render items that do not have label specified
    var itemsToRender = itemsGroup
        ? itemsGroup.map(function (group) {
            var _a;
            return (__assign(__assign({}, group), { items: (_a = group.items) === null || _a === void 0 ? void 0 : _a.filter(function (item) { return item.label; }) }));
        })
        : [];
    var renderHeader = function () {
        var _a;
        if (!source) {
            return null;
        }
        // If dimensions supplied, we can calculate and display value
        var value;
        if ((dimensions === null || dimensions === void 0 ? void 0 : dimensions.yAxis) && ((_a = contextDimensions === null || contextDimensions === void 0 ? void 0 : contextDimensions.yAxis) === null || _a === void 0 ? void 0 : _a[1])) {
            var valueFromDimensions = getValueFromDimension(dimensions.yAxis, contextDimensions.yAxis[0], contextDimensions.yAxis[1]);
            var display = source.series.valueField.display;
            value = display(valueFromDimensions);
        }
        var formattedValue = dateTimeFormat(source.datapoint[0], {
            defaultWithMS: source.series.hasMsResolution,
            timeZone: timeZone,
        });
        return (React.createElement(GraphContextMenuHeader, { timestamp: formattedValue, seriesColor: source.series.color, displayName: source.series.alias || source.series.label, displayValue: value }));
    };
    var renderMenuGroupItems = function () {
        return itemsToRender === null || itemsToRender === void 0 ? void 0 : itemsToRender.map(function (group, index) { return (React.createElement(MenuGroup, { key: "" + group.label + index, label: group.label }, (group.items || []).map(function (item) { return (React.createElement(MenuItem, { key: "" + item.label, url: item.url, label: item.label, target: item.target, icon: item.icon, active: item.active, onClick: item.onClick })); }))); });
    };
    return React.createElement(ContextMenu, __assign({}, otherProps, { renderMenuItems: renderMenuGroupItems, renderHeader: renderHeader }));
};
/** @internal */
export var GraphContextMenuHeader = function (_a) {
    var timestamp = _a.timestamp, seriesColor = _a.seriesColor, displayName = _a.displayName, displayValue = _a.displayValue;
    var theme = useTheme();
    return (React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        padding: ", " ", ";\n        font-size: ", ";\n        z-index: ", ";\n      "], ["\n        padding: ", " ", ";\n        font-size: ", ";\n        z-index: ", ";\n      "])), theme.spacing.xs, theme.spacing.sm, theme.typography.size.sm, theme.zIndex.tooltip) },
        React.createElement("strong", null, timestamp),
        React.createElement(HorizontalGroup, null,
            React.createElement("div", null,
                React.createElement(SeriesIcon, { color: seriesColor }),
                React.createElement("span", { className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n              white-space: nowrap;\n              padding-left: ", ";\n            "], ["\n              white-space: nowrap;\n              padding-left: ", ";\n            "])), theme.spacing.xs) }, displayName)),
            displayValue && React.createElement(FormattedValueDisplay, { value: displayValue }))));
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=GraphContextMenu.js.map