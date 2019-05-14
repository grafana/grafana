import React from 'react';
import DropDownChild from './DropDownChild';
var SideMenuDropDown = function (props) {
    var link = props.link;
    return (React.createElement("ul", { className: "dropdown-menu dropdown-menu--sidemenu", role: "menu" },
        React.createElement("li", { className: "side-menu-header" },
            React.createElement("a", { className: "side-menu-header-link", href: link.url },
                React.createElement("span", { className: "sidemenu-item-text" }, link.text))),
        link.children &&
            link.children.map(function (child, index) {
                return React.createElement(DropDownChild, { child: child, key: child.url + "-" + index });
            })));
};
export default SideMenuDropDown;
//# sourceMappingURL=SideMenuDropDown.js.map