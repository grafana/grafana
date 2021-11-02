import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Button, LoadingPlaceholder } from '@grafana/ui';
var UserOrganizations = /** @class */ (function (_super) {
    __extends(UserOrganizations, _super);
    function UserOrganizations() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UserOrganizations.prototype.render = function () {
        var _this = this;
        var _a = this.props, isLoading = _a.isLoading, orgs = _a.orgs, user = _a.user;
        if (isLoading) {
            return React.createElement(LoadingPlaceholder, { text: "Loading organizations..." });
        }
        if (orgs.length === 0) {
            return null;
        }
        return (React.createElement("div", null,
            React.createElement("h3", { className: "page-sub-heading" }, "Organizations"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("table", { className: "filter-table form-inline", "aria-label": "User organizations table" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "Name"),
                            React.createElement("th", null, "Role"),
                            React.createElement("th", null))),
                    React.createElement("tbody", null, orgs.map(function (org, index) {
                        return (React.createElement("tr", { key: index },
                            React.createElement("td", null, org.name),
                            React.createElement("td", null, org.role),
                            React.createElement("td", { className: "text-right" }, org.orgId === (user === null || user === void 0 ? void 0 : user.orgId) ? (React.createElement(Button, { variant: "secondary", size: "sm", disabled: true }, "Current")) : (React.createElement(Button, { variant: "secondary", size: "sm", onClick: function () {
                                    _this.props.setUserOrg(org);
                                }, "aria-label": "Switch to the organization named " + org.name }, "Select")))));
                    }))))));
    };
    return UserOrganizations;
}(PureComponent));
export { UserOrganizations };
export default UserOrganizations;
//# sourceMappingURL=UserOrganizations.js.map