import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import appEvents from '../../app_events';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
import config from 'app/core/config';
var homeUrl = config.appSubUrl || '/';
var SideMenu = /** @class */ (function (_super) {
    tslib_1.__extends(SideMenu, _super);
    function SideMenu() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.toggleSideMenuSmallBreakpoint = function () {
            appEvents.emit('toggle-sidemenu-mobile');
        };
        return _this;
    }
    SideMenu.prototype.render = function () {
        return [
            React.createElement("a", { href: homeUrl, className: "sidemenu__logo", key: "logo" },
                React.createElement("img", { src: "public/img/grafana_icon.svg", alt: "Grafana" })),
            React.createElement("div", { className: "sidemenu__logo_small_breakpoint", onClick: this.toggleSideMenuSmallBreakpoint, key: "hamburger" },
                React.createElement("i", { className: "fa fa-bars" }),
                React.createElement("span", { className: "sidemenu__close" },
                    React.createElement("i", { className: "fa fa-times" }),
                    "\u00A0Close")),
            React.createElement(TopSection, { key: "topsection" }),
            React.createElement(BottomSection, { key: "bottomsection" }),
        ];
    };
    return SideMenu;
}(PureComponent));
export { SideMenu };
//# sourceMappingURL=SideMenu.js.map