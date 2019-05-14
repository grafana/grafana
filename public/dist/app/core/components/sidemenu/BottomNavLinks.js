import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import appEvents from '../../app_events';
var BottomNavLinks = /** @class */ (function (_super) {
    tslib_1.__extends(BottomNavLinks, _super);
    function BottomNavLinks() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.itemClicked = function (event, child) {
            if (child.url === '/shortcuts') {
                event.preventDefault();
                appEvents.emit('show-modal', {
                    templateHtml: '<help-modal></help-modal>',
                });
            }
        };
        _this.switchOrg = function () {
            appEvents.emit('show-modal', {
                templateHtml: '<org-switcher dismiss="dismiss()"></org-switcher>',
            });
        };
        return _this;
    }
    BottomNavLinks.prototype.render = function () {
        var _this = this;
        var _a = this.props, link = _a.link, user = _a.user;
        return (React.createElement("div", { className: "sidemenu-item dropdown dropup" },
            React.createElement("a", { href: link.url, className: "sidemenu-link", target: link.target },
                React.createElement("span", { className: "icon-circle sidemenu-icon" },
                    link.icon && React.createElement("i", { className: link.icon }),
                    link.img && React.createElement("img", { src: link.img }))),
            React.createElement("ul", { className: "dropdown-menu dropdown-menu--sidemenu", role: "menu" },
                link.subTitle && (React.createElement("li", { className: "sidemenu-subtitle" },
                    React.createElement("span", { className: "sidemenu-item-text" }, link.subTitle))),
                link.showOrgSwitcher && (React.createElement("li", { className: "sidemenu-org-switcher" },
                    React.createElement("a", { onClick: this.switchOrg },
                        React.createElement("div", null,
                            React.createElement("div", { className: "sidemenu-org-switcher__org-name" }, user.orgName),
                            React.createElement("div", { className: "sidemenu-org-switcher__org-current" }, "Current Org:")),
                        React.createElement("div", { className: "sidemenu-org-switcher__switch" },
                            React.createElement("i", { className: "fa fa-fw fa-random" }),
                            "Switch")))),
                link.children &&
                    link.children.map(function (child, index) {
                        if (!child.hideFromMenu) {
                            return (React.createElement("li", { className: child.divider, key: child.text + "-" + index },
                                React.createElement("a", { href: child.url, target: child.target, onClick: function (event) { return _this.itemClicked(event, child); } },
                                    child.icon && React.createElement("i", { className: child.icon }),
                                    child.text)));
                        }
                        return null;
                    }),
                React.createElement("li", { className: "side-menu-header" },
                    React.createElement("span", { className: "sidemenu-item-text" }, link.text)))));
    };
    return BottomNavLinks;
}(PureComponent));
export default BottomNavLinks;
//# sourceMappingURL=BottomNavLinks.js.map