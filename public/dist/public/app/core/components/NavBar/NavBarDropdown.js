import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Link, useTheme2 } from '@grafana/ui';
import DropdownChild from './DropdownChild';
var NavBarDropdown = function (_a) {
    var headerTarget = _a.headerTarget, headerText = _a.headerText, headerUrl = _a.headerUrl, _b = _a.items, items = _b === void 0 ? [] : _b, onHeaderClick = _a.onHeaderClick, _c = _a.reverseDirection, reverseDirection = _c === void 0 ? false : _c, subtitleText = _a.subtitleText;
    var filteredItems = items.filter(function (item) { return !item.hideFromMenu; });
    var theme = useTheme2();
    var styles = getStyles(theme, reverseDirection, filteredItems);
    var header = (React.createElement("button", { onClick: onHeaderClick, className: styles.header }, headerText));
    if (headerUrl) {
        header =
            !headerTarget && headerUrl.startsWith('/') ? (React.createElement(Link, { href: headerUrl, onClick: onHeaderClick, className: styles.header }, headerText)) : (React.createElement("a", { href: headerUrl, target: headerTarget, onClick: onHeaderClick, className: styles.header }, headerText));
    }
    return (React.createElement("ul", { className: styles.menu + " dropdown-menu dropdown-menu--sidemenu", role: "menu" },
        React.createElement("li", null, header),
        filteredItems.map(function (child, index) { return (React.createElement(DropdownChild, { key: child.url + "-" + index, isDivider: child.divider, icon: child.icon, onClick: child.onClick, target: child.target, text: child.text, url: child.url })); }),
        subtitleText && React.createElement("li", { className: styles.subtitle }, subtitleText)));
};
export default NavBarDropdown;
var getStyles = function (theme, reverseDirection, filteredItems) {
    var adjustHeightForBorder = filteredItems.length === 0;
    return {
        header: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      align-items: center;\n      background-color: ", ";\n      border: none;\n      color: ", ";\n      height: ", "px;\n      font-size: ", ";\n      font-weight: ", ";\n      padding: ", " ", " ", " ", " !important;\n      white-space: nowrap;\n      width: 100%;\n\n      &:hover {\n        background-color: ", ";\n      }\n\n      .sidemenu-open--xs & {\n        display: flex;\n        font-size: ", ";\n        font-weight: ", ";\n        padding-left: ", " !important;\n      }\n    "], ["\n      align-items: center;\n      background-color: ", ";\n      border: none;\n      color: ", ";\n      height: ", "px;\n      font-size: ", ";\n      font-weight: ", ";\n      padding: ", " ", " ", " ", " !important;\n      white-space: nowrap;\n      width: 100%;\n\n      &:hover {\n        background-color: ", ";\n      }\n\n      .sidemenu-open--xs & {\n        display: flex;\n        font-size: ", ";\n        font-weight: ", ";\n        padding-left: ", " !important;\n      }\n    "])), theme.colors.background.secondary, theme.colors.text.primary, theme.components.sidemenu.width - (adjustHeightForBorder ? 2 : 1), theme.typography.h4.fontSize, theme.typography.h4.fontWeight, theme.spacing(1), theme.spacing(1), theme.spacing(1), theme.spacing(2), theme.colors.action.hover, theme.typography.body.fontSize, theme.typography.body.fontWeight, theme.spacing(1)),
        menu: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      border: 1px solid ", ";\n      flex-direction: ", ";\n\n      .sidemenu-open--xs & {\n        display: flex;\n        flex-direction: column;\n        float: none;\n        margin-bottom: ", ";\n        position: unset;\n        width: 100%;\n      }\n    "], ["\n      border: 1px solid ", ";\n      flex-direction: ", ";\n\n      .sidemenu-open--xs & {\n        display: flex;\n        flex-direction: column;\n        float: none;\n        margin-bottom: ", ";\n        position: unset;\n        width: 100%;\n      }\n    "])), theme.components.panel.borderColor, reverseDirection ? 'column-reverse' : 'column', theme.spacing(1)),
        subtitle: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      border-bottom: 1px solid ", ";\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      margin-bottom: ", ";\n      padding: ", " ", " ", ";\n      white-space: nowrap;\n\n      .sidemenu-open--xs & {\n        border-bottom: none;\n        margin-bottom: 0;\n      }\n    "], ["\n      border-bottom: 1px solid ", ";\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      margin-bottom: ", ";\n      padding: ", " ", " ", ";\n      white-space: nowrap;\n\n      .sidemenu-open--xs & {\n        border-bottom: none;\n        margin-bottom: 0;\n      }\n    "])), theme.colors.border.weak, theme.colors.text.secondary, theme.typography.bodySmall.fontSize, theme.typography.bodySmall.fontWeight, theme.spacing(1), theme.spacing(1), theme.spacing(2), theme.spacing(1)),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=NavBarDropdown.js.map