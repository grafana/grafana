import React from 'react';
var SignIn = function () {
    var loginUrl = "login?redirect=" + encodeURIComponent(window.location.pathname);
    return (React.createElement("div", { className: "sidemenu-item" },
        React.createElement("a", { href: loginUrl, className: "sidemenu-link", target: "_self" },
            React.createElement("span", { className: "icon-circle sidemenu-icon" },
                React.createElement("i", { className: "fa fa-fw fa-sign-in" }))),
        React.createElement("a", { href: loginUrl, target: "_self" },
            React.createElement("ul", { className: "dropdown-menu dropdown-menu--sidemenu", role: "menu" },
                React.createElement("li", { className: "side-menu-header" },
                    React.createElement("span", { className: "sidemenu-item-text" }, "Sign In"))))));
};
export default SignIn;
//# sourceMappingURL=SignIn.js.map