import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useStyles2, useTheme2 } from '../../themes';
/**
 * @internal
 */
export var PanelChrome = function (_a) {
    var _b = _a.title, title = _b === void 0 ? '' : _b, children = _a.children, width = _a.width, height = _a.height, _c = _a.padding, padding = _c === void 0 ? 'md' : _c, _d = _a.leftItems, leftItems = _d === void 0 ? [] : _d;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var headerHeight = getHeaderHeight(theme, title, leftItems);
    var _e = getContentStyle(padding, theme, width, headerHeight, height), contentStyle = _e.contentStyle, innerWidth = _e.innerWidth, innerHeight = _e.innerHeight;
    var headerStyles = {
        height: headerHeight,
    };
    var containerStyles = { width: width, height: height };
    return (React.createElement("div", { className: styles.container, style: containerStyles },
        React.createElement("div", { className: styles.header, style: headerStyles },
            React.createElement("div", { className: styles.headerTitle }, title),
            itemsRenderer(leftItems, function (items) {
                return React.createElement("div", { className: styles.leftItems }, items);
            })),
        React.createElement("div", { className: styles.content, style: contentStyle }, children(innerWidth, innerHeight))));
};
var itemsRenderer = function (items, renderer) {
    var toRender = React.Children.toArray(items).filter(Boolean);
    return toRender.length > 0 ? renderer(toRender) : null;
};
var getHeaderHeight = function (theme, title, items) {
    if (title.length > 0 || items.length > 0) {
        return theme.spacing.gridSize * theme.components.panel.headerHeight;
    }
    return 0;
};
var getContentStyle = function (padding, theme, width, headerHeight, height) {
    var chromePadding = padding === 'md' ? theme.components.panel.padding : 0;
    var panelBorder = 1 * 2;
    var innerWidth = width - chromePadding * 2 - panelBorder;
    var innerHeight = height - headerHeight - chromePadding * 2 - panelBorder;
    var contentStyle = {
        padding: chromePadding,
    };
    return { contentStyle: contentStyle, innerWidth: innerWidth, innerHeight: innerHeight };
};
var getStyles = function (theme) {
    var _a = theme.components.panel, padding = _a.padding, background = _a.background, borderColor = _a.borderColor;
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: panel-container;\n      background-color: ", ";\n      border: 1px solid ", ";\n      position: relative;\n      border-radius: 3px;\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n      flex: 0 0 0;\n    "], ["\n      label: panel-container;\n      background-color: ", ";\n      border: 1px solid ", ";\n      position: relative;\n      border-radius: 3px;\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n      flex: 0 0 0;\n    "])), background, borderColor),
        content: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: panel-content;\n      width: 100%;\n      flex-grow: 1;\n    "], ["\n      label: panel-content;\n      width: 100%;\n      flex-grow: 1;\n    "]))),
        header: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: panel-header;\n      display: flex;\n      align-items: center;\n    "], ["\n      label: panel-header;\n      display: flex;\n      align-items: center;\n    "]))),
        headerTitle: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: panel-header;\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      padding-left: ", ";\n      flex-grow: 1;\n      font-weight: ", ";\n    "], ["\n      label: panel-header;\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      padding-left: ", ";\n      flex-grow: 1;\n      font-weight: ", ";\n    "])), theme.spacing(padding), theme.typography.fontWeightMedium),
        leftItems: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      padding-right: ", ";\n    "], ["\n      display: flex;\n      padding-right: ", ";\n    "])), theme.spacing(padding)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=PanelChrome.js.map