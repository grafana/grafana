import React from 'react';
export var PanelHeaderMenuItem = function (props) {
    var isSubMenu = props.type === 'submenu';
    var isDivider = props.type === 'divider';
    return isDivider ? (React.createElement("li", { className: "divider" })) : (React.createElement("li", { className: isSubMenu ? 'dropdown-submenu' : null },
        React.createElement("a", { onClick: props.onClick },
            props.iconClassName && React.createElement("i", { className: props.iconClassName }),
            React.createElement("span", { className: "dropdown-item-text" }, props.text),
            props.shortcut && React.createElement("span", { className: "dropdown-menu-item-shortcut" }, props.shortcut)),
        props.children));
};
//# sourceMappingURL=PanelHeaderMenuItem.js.map