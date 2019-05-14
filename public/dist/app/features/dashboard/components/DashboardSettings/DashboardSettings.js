import * as tslib_1 from "tslib";
// Libaries
import React, { PureComponent } from 'react';
// Utils & Services
import { getAngularLoader } from 'app/core/services/AngularLoader';
var DashboardSettings = /** @class */ (function (_super) {
    tslib_1.__extends(DashboardSettings, _super);
    function DashboardSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DashboardSettings.prototype.componentDidMount = function () {
        var loader = getAngularLoader();
        var template = '<dashboard-settings dashboard="dashboard" class="dashboard-settings" />';
        var scopeProps = { dashboard: this.props.dashboard };
        this.angularCmp = loader.load(this.element, scopeProps, template);
    };
    DashboardSettings.prototype.componentWillUnmount = function () {
        if (this.angularCmp) {
            this.angularCmp.destroy();
        }
    };
    DashboardSettings.prototype.render = function () {
        var _this = this;
        return React.createElement("div", { className: "panel-height-helper", ref: function (element) { return (_this.element = element); } });
    };
    return DashboardSettings;
}(PureComponent));
export { DashboardSettings };
//# sourceMappingURL=DashboardSettings.js.map