import React, { PureComponent } from 'react';
import { Select, Icon, Button } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';
const setClassNameHelper = (inherited) => {
    return inherited ? 'gf-form-disabled' : '';
};
function ItemAvatar({ item }) {
    if (item.userAvatarUrl) {
        return React.createElement("img", { className: "filter-table__avatar", src: item.userAvatarUrl, alt: "User avatar" });
    }
    if (item.teamAvatarUrl) {
        return React.createElement("img", { className: "filter-table__avatar", src: item.teamAvatarUrl, alt: "Team avatar" });
    }
    if (item.role === 'Editor') {
        return React.createElement(Icon, { size: "lg", name: "edit" });
    }
    return React.createElement(Icon, { size: "lg", name: "eye" });
}
function ItemDescription({ item }) {
    if (item.userId) {
        return React.createElement("span", { className: "filter-table__weak-italic" }, "(User)");
    }
    if (item.teamId) {
        return React.createElement("span", { className: "filter-table__weak-italic" }, "(Team)");
    }
    return React.createElement("span", { className: "filter-table__weak-italic" }, "(Role)");
}
export default class PermissionsListItem extends PureComponent {
    constructor() {
        super(...arguments);
        this.onPermissionChanged = (option) => {
            this.props.onPermissionChanged(this.props.item, option.value);
        };
        this.onRemoveItem = () => {
            this.props.onRemoveItem(this.props.item);
        };
    }
    render() {
        const { item, folderInfo } = this.props;
        const inheritedFromRoot = item.dashboardId === -1 && !item.inherited;
        const currentPermissionLevel = dashboardPermissionLevels.find((dp) => dp.value === item.permission);
        return (React.createElement("tr", { className: setClassNameHelper(Boolean(item === null || item === void 0 ? void 0 : item.inherited)) },
            React.createElement("td", { style: { width: '1%' } },
                React.createElement(ItemAvatar, { item: item })),
            React.createElement("td", { style: { width: '90%' } },
                item.name,
                " ",
                React.createElement(ItemDescription, { item: item })),
            React.createElement("td", null,
                item.inherited && folderInfo && (React.createElement("em", { className: "muted no-wrap" },
                    "Inherited from folder",
                    ' ',
                    folderInfo.canViewFolderPermissions ? (React.createElement("a", { className: "text-link", href: `${folderInfo.url}/permissions` }, folderInfo.title)) : (folderInfo.title))),
                inheritedFromRoot && React.createElement("em", { className: "muted no-wrap" }, "Default Permission")),
            React.createElement("td", { className: "query-keyword" }, "Can"),
            React.createElement("td", null,
                React.createElement(Select, { "aria-label": `Permission level for "${item.name}"`, isSearchable: false, options: dashboardPermissionLevels, onChange: this.onPermissionChanged, disabled: item.inherited, value: currentPermissionLevel, width: 25 })),
            React.createElement("td", null, !item.inherited ? (React.createElement(Button, { "aria-label": `Remove permission for "${item.name}"`, size: "sm", variant: "destructive", icon: "times", onClick: this.onRemoveItem })) : (React.createElement(Button, { "aria-label": `Remove permission for "${item.name}" (Disabled)`, size: "sm", disabled: true, icon: "times" })))));
    }
}
//# sourceMappingURL=PermissionListItem.js.map