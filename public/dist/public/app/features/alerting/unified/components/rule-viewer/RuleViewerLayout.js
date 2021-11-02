import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { locationService } from '@grafana/runtime';
import { PageToolbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
export function RuleViewerLayout(props) {
    var _a = props.wrapInContent, wrapInContent = _a === void 0 ? true : _a, children = props.children, title = props.title;
    var styles = useStyles2(getPageStyles);
    return (React.createElement(Page, null,
        React.createElement(PageToolbar, { title: title, pageIcon: "bell", onGoBack: function () { return locationService.push('/alerting/list'); } }),
        React.createElement("div", { className: styles.content }, wrapInContent ? React.createElement(RuleViewerLayoutContent, __assign({}, props)) : children)));
}
export function RuleViewerLayoutContent(_a) {
    var children = _a.children, _b = _a.padding, padding = _b === void 0 ? 2 : _b;
    var styles = useStyles2(getContentStyles(padding));
    return React.createElement("div", { className: styles.wrapper }, children);
}
var getPageStyles = function (theme) {
    return {
        content: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin: ", ";\n      max-width: ", "px;\n    "], ["\n      margin: ", ";\n      max-width: ", "px;\n    "])), theme.spacing(0, 2, 2), theme.breakpoints.values.xxl),
    };
};
var getContentStyles = function (padding) { return function (theme) {
    return {
        wrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      padding: ", ";\n    "], ["\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      padding: ", ";\n    "])), theme.colors.background.primary, theme.colors.border.weak, theme.shape.borderRadius(), theme.spacing(padding)),
    };
}; };
var templateObject_1, templateObject_2;
//# sourceMappingURL=RuleViewerLayout.js.map