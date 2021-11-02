import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Modal, useStyles2 } from '@grafana/ui';
var shortcuts = {
    Global: [
        { keys: ['g', 'h'], description: 'Go to Home Dashboard' },
        { keys: ['g', 'p'], description: 'Go to Profile' },
        { keys: ['s', 'o'], description: 'Open search' },
        { keys: ['esc'], description: 'Exit edit/setting views' },
    ],
    Dashboard: [
        { keys: ['mod+s'], description: 'Save dashboard' },
        { keys: ['d', 'r'], description: 'Refresh all panels' },
        { keys: ['d', 's'], description: 'Dashboard settings' },
        { keys: ['d', 'v'], description: 'Toggle in-active / view mode' },
        { keys: ['d', 'k'], description: 'Toggle kiosk mode (hides top nav)' },
        { keys: ['d', 'E'], description: 'Expand all rows' },
        { keys: ['d', 'C'], description: 'Collapse all rows' },
        { keys: ['d', 'a'], description: 'Toggle auto fit panels (experimental feature)' },
        { keys: ['mod+o'], description: 'Toggle shared graph crosshair' },
        { keys: ['d', 'l'], description: 'Toggle all panel legends' },
    ],
    'Focused Panel': [
        { keys: ['e'], description: 'Toggle panel edit view' },
        { keys: ['v'], description: 'Toggle panel fullscreen view' },
        { keys: ['p', 's'], description: 'Open Panel Share Modal' },
        { keys: ['p', 'd'], description: 'Duplicate Panel' },
        { keys: ['p', 'r'], description: 'Remove Panel' },
        { keys: ['p', 'l'], description: 'Toggle panel legend' },
    ],
    'Time Range': [
        { keys: ['t', 'z'], description: 'Zoom out time range' },
        {
            keys: ['t', '←'],
            description: 'Move time range back',
        },
        {
            keys: ['t', '→'],
            description: 'Move time range forward',
        },
    ],
};
export var HelpModal = function (_a) {
    var onDismiss = _a.onDismiss;
    var styles = useStyles2(getStyles);
    return (React.createElement(Modal, { title: "Shortcuts", isOpen: true, onDismiss: onDismiss, onClickBackdrop: onDismiss },
        React.createElement("div", { className: styles.titleDescription },
            React.createElement("span", { className: styles.shortcutTableKey }, "mod"),
            " =",
            React.createElement("span", null, " CTRL on windows or linux and CMD key on Mac")),
        React.createElement("div", { className: styles.categories }, Object.entries(shortcuts).map(function (_a, i) {
            var _b = __read(_a, 2), category = _b[0], shortcuts = _b[1];
            return (React.createElement("div", { className: styles.shortcutCategory, key: i },
                React.createElement("table", { className: styles.shortcutTable },
                    React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("th", { className: styles.shortcutTableCategoryHeader, colSpan: 2 }, category)),
                        shortcuts.map(function (shortcut, j) { return (React.createElement("tr", { key: i + "-" + j },
                            React.createElement("td", { className: styles.shortcutTableKeys }, shortcut.keys.map(function (key, k) { return (React.createElement("span", { className: styles.shortcutTableKey, key: i + "-" + j + "-" + k }, key)); })),
                            React.createElement("td", { className: styles.shortcutTableDescription }, shortcut.description))); })))));
        }))));
};
function getStyles(theme) {
    return {
        titleDescription: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-size: ", ";\n      font-weight: ", ";\n      color: ", ";\n      padding-bottom: ", ";\n    "], ["\n      font-size: ", ";\n      font-weight: ", ";\n      color: ", ";\n      padding-bottom: ", ";\n    "])), theme.typography.bodySmall.fontSize, theme.typography.bodySmall.fontWeight, theme.colors.text.disabled, theme.spacing(2)),
        categories: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      font-size: ", ";\n      display: flex;\n      flex-flow: row wrap;\n      justify-content: space-between;\n      align-items: flex-start;\n    "], ["\n      font-size: ", ";\n      display: flex;\n      flex-flow: row wrap;\n      justify-content: space-between;\n      align-items: flex-start;\n    "])), theme.typography.bodySmall.fontSize),
        shortcutCategory: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      width: 50%;\n      font-size: ", ";\n    "], ["\n      width: 50%;\n      font-size: ", ";\n    "])), theme.typography.bodySmall.fontSize),
        shortcutTable: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(2)),
        shortcutTableCategoryHeader: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      font-weight: normal;\n      font-size: ", ";\n      text-align: left;\n    "], ["\n      font-weight: normal;\n      font-size: ", ";\n      text-align: left;\n    "])), theme.typography.h6.fontSize),
        shortcutTableDescription: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      text-align: left;\n      color: ", ";\n      width: 99%;\n      padding: ", ";\n    "], ["\n      text-align: left;\n      color: ", ";\n      width: 99%;\n      padding: ", ";\n    "])), theme.colors.text.disabled, theme.spacing(1, 2)),
        shortcutTableKeys: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      white-space: nowrap;\n      width: 1%;\n      text-align: right;\n      color: ", ";\n    "], ["\n      white-space: nowrap;\n      width: 1%;\n      text-align: right;\n      color: ", ";\n    "])), theme.colors.text.primary),
        shortcutTableKey: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      display: inline-block;\n      text-align: center;\n      margin-right: ", ";\n      padding: 3px 5px;\n      font: 11px Consolas, 'Liberation Mono', Menlo, Courier, monospace;\n      line-height: 10px;\n      vertical-align: middle;\n      border: solid 1px ", ";\n      border-radius: ", ";\n      color: ", ";\n      background-color: ", ";\n    "], ["\n      display: inline-block;\n      text-align: center;\n      margin-right: ", ";\n      padding: 3px 5px;\n      font: 11px Consolas, 'Liberation Mono', Menlo, Courier, monospace;\n      line-height: 10px;\n      vertical-align: middle;\n      border: solid 1px ", ";\n      border-radius: ", ";\n      color: ", ";\n      background-color: ", ";\n    "])), theme.spacing(0.5), theme.colors.border.medium, theme.shape.borderRadius(3), theme.colors.text.primary, theme.colors.background.secondary),
    };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=HelpModal.js.map