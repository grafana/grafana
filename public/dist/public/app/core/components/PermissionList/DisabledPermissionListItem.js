import { __extends } from "tslib";
import React, { Component } from 'react';
import { Select, Icon, Button } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';
var DisabledPermissionListItem = /** @class */ (function (_super) {
    __extends(DisabledPermissionListItem, _super);
    function DisabledPermissionListItem() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DisabledPermissionListItem.prototype.render = function () {
        var item = this.props.item;
        var currentPermissionLevel = dashboardPermissionLevels.find(function (dp) { return dp.value === item.permission; });
        return (React.createElement("tr", { className: "gf-form-disabled" },
            React.createElement("td", { style: { width: '1%' } },
                React.createElement(Icon, { size: "lg", name: "shield" })),
            React.createElement("td", { style: { width: '90%' } },
                item.name,
                React.createElement("span", { className: "filter-table__weak-italic" }, " (Role)")),
            React.createElement("td", null),
            React.createElement("td", { className: "query-keyword" }, "Can"),
            React.createElement("td", null,
                React.createElement("div", { className: "gf-form" },
                    React.createElement(Select, { "aria-label": "Permission level for \"" + item.name + "\"", options: dashboardPermissionLevels, onChange: function () { }, disabled: true, value: currentPermissionLevel, menuShouldPortal: true }))),
            React.createElement("td", null,
                React.createElement(Button, { "aria-label": "Remove permission for \"" + item.name + "\"", size: "sm", icon: "lock", disabled: true }))));
    };
    return DisabledPermissionListItem;
}(Component));
export default DisabledPermissionListItem;
//# sourceMappingURL=DisabledPermissionListItem.js.map