import * as tslib_1 from "tslib";
import React, { Component } from 'react';
import { Select } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';
var DisabledPermissionListItem = /** @class */ (function (_super) {
    tslib_1.__extends(DisabledPermissionListItem, _super);
    function DisabledPermissionListItem() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DisabledPermissionListItem.prototype.render = function () {
        var item = this.props.item;
        var currentPermissionLevel = dashboardPermissionLevels.find(function (dp) { return dp.value === item.permission; });
        return (React.createElement("tr", { className: "gf-form-disabled" },
            React.createElement("td", { style: { width: '1%' } },
                React.createElement("i", { style: { width: '25px', height: '25px' }, className: "gicon gicon-shield" })),
            React.createElement("td", { style: { width: '90%' } },
                item.name,
                React.createElement("span", { className: "filter-table__weak-italic" }, " (Role)")),
            React.createElement("td", null),
            React.createElement("td", { className: "query-keyword" }, "Can"),
            React.createElement("td", null,
                React.createElement("div", { className: "gf-form" },
                    React.createElement(Select, { options: dashboardPermissionLevels, onChange: function () { }, isDisabled: true, className: "gf-form-select-box__control--menu-right", value: currentPermissionLevel }))),
            React.createElement("td", null,
                React.createElement("button", { className: "btn btn-inverse btn-small" },
                    React.createElement("i", { className: "fa fa-lock" })))));
    };
    return DisabledPermissionListItem;
}(Component));
export default DisabledPermissionListItem;
//# sourceMappingURL=DisabledPermissionListItem.js.map