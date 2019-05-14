import React from 'react';
import SideMenuDropDown from './SideMenuDropDown';
var TopSectionItem = function (props) {
    var link = props.link;
    return (React.createElement("div", { className: "sidemenu-item dropdown" },
        React.createElement("a", { className: "sidemenu-link", href: link.url, target: link.target },
            React.createElement("span", { className: "icon-circle sidemenu-icon" },
                React.createElement("i", { className: link.icon }),
                link.img && React.createElement("img", { src: link.img }))),
        React.createElement(SideMenuDropDown, { link: link })));
};
export default TopSectionItem;
//# sourceMappingURL=TopSectionItem.js.map