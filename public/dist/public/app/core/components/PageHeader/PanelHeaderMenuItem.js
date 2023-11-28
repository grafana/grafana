import { css } from '@emotion/css';
import React, { useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, toIconName, useStyles2 } from '@grafana/ui';
export const PanelHeaderMenuItem = (props) => {
    const [ref, setRef] = useState(null);
    const isSubMenu = props.type === 'submenu';
    const styles = useStyles2(getStyles);
    const icon = props.iconClassName ? toIconName(props.iconClassName) : undefined;
    switch (props.type) {
        case 'divider':
            return React.createElement("li", { className: "divider" });
        case 'group':
            return (React.createElement("li", null,
                React.createElement("span", { className: styles.groupLabel }, props.text)));
        default:
            return (React.createElement("li", { className: isSubMenu ? `dropdown-submenu ${getDropdownLocationCssClass(ref)}` : undefined, ref: setRef, "data-testid": selectors.components.Panels.Panel.menuItems(props.text) },
                React.createElement("a", { onClick: props.onClick, href: props.href, role: "menuitem" },
                    icon && React.createElement(Icon, { name: icon, className: styles.menuIconClassName }),
                    React.createElement("span", { className: "dropdown-item-text", "aria-label": selectors.components.Panels.Panel.headerItems(props.text) },
                        props.text,
                        isSubMenu && React.createElement(Icon, { name: "angle-right", className: styles.shortcutIconClassName })),
                    props.shortcut && (React.createElement("span", { className: "dropdown-menu-item-shortcut" },
                        React.createElement(Icon, { name: "keyboard", className: styles.menuIconClassName }),
                        " ",
                        props.shortcut))),
                props.children));
    }
};
function getDropdownLocationCssClass(element) {
    if (!element) {
        return 'invisible';
    }
    const wrapperPos = element.parentElement.getBoundingClientRect();
    const pos = element.getBoundingClientRect();
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
function getStyles(theme) {
    return {
        menuIconClassName: css({
            marginRight: theme.spacing(1),
            'a::after': {
                display: 'none',
            },
        }),
        shortcutIconClassName: css({
            position: 'absolute',
            top: '7px',
            right: theme.spacing(0.5),
            color: theme.colors.text.secondary,
        }),
        groupLabel: css({
            color: theme.colors.text.secondary,
            fontSize: theme.typography.size.sm,
            padding: theme.spacing(0.5, 1),
        }),
    };
}
//# sourceMappingURL=PanelHeaderMenuItem.js.map