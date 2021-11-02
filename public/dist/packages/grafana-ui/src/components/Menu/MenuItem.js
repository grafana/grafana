import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
/** @internal */
export var MenuItem = React.memo(React.forwardRef(function (_a, ref) {
    var _b;
    var url = _a.url, icon = _a.icon, label = _a.label, ariaLabel = _a.ariaLabel, target = _a.target, onClick = _a.onClick, className = _a.className, active = _a.active, _c = _a.tabIndex, tabIndex = _c === void 0 ? -1 : _c;
    var styles = useStyles2(getStyles);
    var itemStyle = cx((_b = {},
        _b[styles.item] = true,
        _b[styles.activeItem] = active,
        _b), className);
    var Wrapper = url === undefined ? 'button' : 'a';
    return (React.createElement(Wrapper, { target: target, className: itemStyle, rel: target === '_blank' ? 'noopener noreferrer' : undefined, href: url, onClick: onClick
            ? function (event) {
                if (!(event.ctrlKey || event.metaKey || event.shiftKey) && onClick) {
                    event.preventDefault();
                    onClick(event);
                }
            }
            : undefined, role: url === undefined ? 'menuitem' : undefined, "data-role": "menuitem" // used to identify menuitem in Menu.tsx
        , ref: ref, "aria-label": ariaLabel, tabIndex: tabIndex },
        icon && React.createElement(Icon, { name: icon, className: styles.icon, "aria-hidden": true }),
        " ",
        label));
}));
MenuItem.displayName = 'MenuItem';
/** @internal */
var getStyles = function (theme) {
    return {
        item: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background: none;\n      cursor: pointer;\n      white-space: nowrap;\n      color: ", ";\n      display: flex;\n      padding: 5px 12px 5px 10px;\n      margin: 0;\n      border: none;\n      width: 100%;\n\n      &:hover,\n      &:focus,\n      &:focus-visible {\n        background: ", ";\n        color: ", ";\n        text-decoration: none;\n      }\n    "], ["\n      background: none;\n      cursor: pointer;\n      white-space: nowrap;\n      color: ", ";\n      display: flex;\n      padding: 5px 12px 5px 10px;\n      margin: 0;\n      border: none;\n      width: 100%;\n\n      &:hover,\n      &:focus,\n      &:focus-visible {\n        background: ", ";\n        color: ", ";\n        text-decoration: none;\n      }\n    "])), theme.colors.text.primary, theme.colors.action.hover, theme.colors.text.primary),
        activeItem: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n    "], ["\n      background: ", ";\n    "])), theme.colors.action.selected),
        icon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      opacity: 0.7;\n      margin-right: 10px;\n      color: ", ";\n    "], ["\n      opacity: 0.7;\n      margin-right: 10px;\n      color: ", ";\n    "])), theme.colors.text.secondary),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=MenuItem.js.map