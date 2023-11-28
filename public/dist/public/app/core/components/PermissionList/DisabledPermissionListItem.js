import React, { Component } from 'react';
import { Select, Icon, Button } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';
export default class DisabledPermissionListItem extends Component {
    render() {
        const { item } = this.props;
        const currentPermissionLevel = dashboardPermissionLevels.find((dp) => dp.value === item.permission);
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
                    React.createElement(Select, { "aria-label": `Permission level for "${item.name}"`, options: dashboardPermissionLevels, onChange: () => { }, disabled: true, value: currentPermissionLevel }))),
            React.createElement("td", null,
                React.createElement(Button, { "aria-label": `Remove permission for "${item.name}"`, size: "sm", icon: "lock", disabled: true }))));
    }
}
//# sourceMappingURL=DisabledPermissionListItem.js.map