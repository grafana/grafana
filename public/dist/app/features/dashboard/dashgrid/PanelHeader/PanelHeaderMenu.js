import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { PanelHeaderMenuItem } from './PanelHeaderMenuItem';
import { getPanelMenu } from 'app/features/dashboard/utils/getPanelMenu';
var PanelHeaderMenu = /** @class */ (function (_super) {
    tslib_1.__extends(PanelHeaderMenu, _super);
    function PanelHeaderMenu() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderItems = function (menu, isSubMenu) {
            if (isSubMenu === void 0) { isSubMenu = false; }
            return (React.createElement("ul", { className: "dropdown-menu dropdown-menu--menu panel-menu", role: isSubMenu ? '' : 'menu' }, menu.map(function (menuItem, idx) {
                return (React.createElement(PanelHeaderMenuItem, { key: "" + menuItem.text + idx, type: menuItem.type, text: menuItem.text, iconClassName: menuItem.iconClassName, onClick: menuItem.onClick, shortcut: menuItem.shortcut }, menuItem.subMenu && _this.renderItems(menuItem.subMenu, true)));
            })));
        };
        return _this;
    }
    PanelHeaderMenu.prototype.render = function () {
        var _a = this.props, dashboard = _a.dashboard, panel = _a.panel;
        var menu = getPanelMenu(dashboard, panel);
        return React.createElement("div", { className: "panel-menu-container dropdown open" }, this.renderItems(menu));
    };
    return PanelHeaderMenu;
}(PureComponent));
export { PanelHeaderMenu };
//# sourceMappingURL=PanelHeaderMenu.js.map