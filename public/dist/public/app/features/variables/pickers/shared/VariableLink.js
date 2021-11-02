import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { css } from '@emotion/css';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
export var VariableLink = function (_a) {
    var loading = _a.loading, propsOnClick = _a.onClick, text = _a.text, onCancel = _a.onCancel, id = _a.id;
    var styles = useStyles(getStyles);
    var onClick = useCallback(function (event) {
        event.stopPropagation();
        event.preventDefault();
        propsOnClick();
    }, [propsOnClick]);
    if (loading) {
        return (React.createElement("div", { className: styles.container, "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts("" + text), title: text, id: id },
            React.createElement(VariableLinkText, { text: text }),
            React.createElement(LoadingIndicator, { onCancel: onCancel })));
    }
    return (React.createElement("button", { onClick: onClick, className: styles.container, "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts("" + text), "aria-expanded": false, "aria-controls": "options-" + id, id: id, title: text },
        React.createElement(VariableLinkText, { text: text }),
        React.createElement(Icon, { "aria-hidden": true, name: "angle-down", size: "sm" })));
};
var VariableLinkText = function (_a) {
    var text = _a.text;
    var styles = useStyles(getStyles);
    return React.createElement("span", { className: styles.textAndTags }, text);
};
var LoadingIndicator = function (_a) {
    var onCancel = _a.onCancel;
    var onClick = useCallback(function (event) {
        event.preventDefault();
        onCancel();
    }, [onCancel]);
    return (React.createElement(Tooltip, { content: "Cancel query" },
        React.createElement(Icon, { className: "spin-clockwise", name: "sync", size: "xs", onClick: onClick, "aria-label": selectors.components.LoadingIndicator.icon })));
};
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    max-width: 500px;\n    padding-right: 10px;\n    padding: 0 ", ";\n    background-color: ", ";\n    border: 1px solid ", ";\n    border-radius: ", ";\n    display: flex;\n    align-items: center;\n    color: ", ";\n    height: ", "px;\n\n    .label-tag {\n      margin: 0 5px;\n    }\n  "], ["\n    max-width: 500px;\n    padding-right: 10px;\n    padding: 0 ", ";\n    background-color: ", ";\n    border: 1px solid ", ";\n    border-radius: ", ";\n    display: flex;\n    align-items: center;\n    color: ", ";\n    height: ", "px;\n\n    .label-tag {\n      margin: 0 5px;\n    }\n  "])), theme.spacing.sm, theme.colors.formInputBg, theme.colors.formInputBorder, theme.border.radius.sm, theme.colors.text, theme.height.md),
    textAndTags: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    margin-right: ", ";\n    user-select: none;\n  "], ["\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    margin-right: ", ";\n    user-select: none;\n  "])), theme.spacing.xxs),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=VariableLink.js.map