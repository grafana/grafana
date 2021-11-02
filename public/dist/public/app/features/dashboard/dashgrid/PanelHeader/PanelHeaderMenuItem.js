import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Icon, useTheme } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
export var PanelHeaderMenuItem = function (props) {
    var _a = __read(useState(null), 2), ref = _a[0], setRef = _a[1];
    var isSubMenu = props.type === 'submenu';
    var isDivider = props.type === 'divider';
    var theme = useTheme();
    var menuIconClassName = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-right: ", ";\n    a::after {\n      display: none;\n    }\n  "], ["\n    margin-right: ", ";\n    a::after {\n      display: none;\n    }\n  "])), theme.spacing.sm);
    var shortcutIconClassName = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    position: absolute;\n    top: 7px;\n    right: ", ";\n    color: ", ";\n  "], ["\n    position: absolute;\n    top: 7px;\n    right: ", ";\n    color: ", ";\n  "])), theme.spacing.xs, theme.colors.textWeak);
    return isDivider ? (React.createElement("li", { className: "divider" })) : (React.createElement("li", { className: isSubMenu ? "dropdown-submenu " + getDropdownLocationCssClass(ref) : undefined, ref: setRef },
        React.createElement("a", { onClick: props.onClick, href: props.href },
            props.iconClassName && React.createElement(Icon, { name: props.iconClassName, className: menuIconClassName }),
            React.createElement("span", { className: "dropdown-item-text", "aria-label": selectors.components.Panels.Panel.headerItems(props.text) },
                props.text,
                isSubMenu && React.createElement(Icon, { name: "angle-right", className: shortcutIconClassName })),
            props.shortcut && (React.createElement("span", { className: "dropdown-menu-item-shortcut" },
                React.createElement(Icon, { name: "keyboard", className: menuIconClassName }),
                " ",
                props.shortcut))),
        props.children));
};
function getDropdownLocationCssClass(element) {
    if (!element) {
        return 'invisible';
    }
    var wrapperPos = element.parentElement.getBoundingClientRect();
    var pos = element.getBoundingClientRect();
    if (pos.width === 0) {
        return 'invisible';
    }
    if (wrapperPos.right + pos.width + 10 > window.innerWidth) {
        return 'pull-left';
    }
    else {
        return 'pull-right';
    }
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=PanelHeaderMenuItem.js.map