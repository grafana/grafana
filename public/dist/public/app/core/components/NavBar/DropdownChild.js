import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Icon, Link, useTheme2 } from '@grafana/ui';
var DropdownChild = function (_a) {
    var _b = _a.isDivider, isDivider = _b === void 0 ? false : _b, icon = _a.icon, onClick = _a.onClick, target = _a.target, text = _a.text, url = _a.url;
    var theme = useTheme2();
    var styles = getStyles(theme);
    var linkContent = (React.createElement("div", { className: styles.linkContent },
        React.createElement("div", null,
            icon && React.createElement(Icon, { "data-testid": "dropdown-child-icon", name: icon, className: styles.icon }),
            text),
        target === '_blank' && (React.createElement(Icon, { "data-testid": "external-link-icon", name: "external-link-alt", className: styles.externalLinkIcon }))));
    var element = (React.createElement("button", { className: styles.element, onClick: onClick }, linkContent));
    if (url) {
        element =
            !target && url.startsWith('/') ? (React.createElement(Link, { className: styles.element, onClick: onClick, href: url }, linkContent)) : (React.createElement("a", { className: styles.element, href: url, target: target, rel: "noopener", onClick: onClick }, linkContent));
    }
    return isDivider ? React.createElement("li", { "data-testid": "dropdown-child-divider", className: "divider" }) : React.createElement("li", null, element);
};
export default DropdownChild;
var getStyles = function (theme) { return ({
    element: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background-color: transparent;\n    border: none;\n    display: flex;\n    width: 100%;\n  "], ["\n    background-color: transparent;\n    border: none;\n    display: flex;\n    width: 100%;\n  "]))),
    externalLinkIcon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n    margin-left: ", ";\n  "], ["\n    color: ", ";\n    margin-left: ", ";\n  "])), theme.colors.text.secondary, theme.spacing(1)),
    icon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(1)),
    linkContent: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    flex: 1;\n    flex-direction: row;\n    justify-content: space-between;\n  "], ["\n    display: flex;\n    flex: 1;\n    flex-direction: row;\n    justify-content: space-between;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=DropdownChild.js.map