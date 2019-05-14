import * as tslib_1 from "tslib";
// Libaries
import React, { PureComponent } from 'react';
// Utils & Services
import { getAngularLoader } from 'app/core/services/AngularLoader';
var SubMenu = /** @class */ (function (_super) {
    tslib_1.__extends(SubMenu, _super);
    function SubMenu() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SubMenu.prototype.componentDidMount = function () {
        var loader = getAngularLoader();
        var template = '<dashboard-submenu dashboard="dashboard" />';
        var scopeProps = { dashboard: this.props.dashboard };
        this.angularCmp = loader.load(this.element, scopeProps, template);
    };
    SubMenu.prototype.componentWillUnmount = function () {
        if (this.angularCmp) {
            this.angularCmp.destroy();
        }
    };
    SubMenu.prototype.render = function () {
        var _this = this;
        return React.createElement("div", { ref: function (element) { return (_this.element = element); } });
    };
    return SubMenu;
}(PureComponent));
export { SubMenu };
//# sourceMappingURL=SubMenu.js.map