import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Select, Icon, Button } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';
var setClassNameHelper = function (inherited) {
    return inherited ? 'gf-form-disabled' : '';
};
function ItemAvatar(_a) {
    var item = _a.item;
    if (item.userAvatarUrl) {
        return React.createElement("img", { className: "filter-table__avatar", src: item.userAvatarUrl });
    }
    if (item.teamAvatarUrl) {
        return React.createElement("img", { className: "filter-table__avatar", src: item.teamAvatarUrl });
    }
    if (item.role === 'Editor') {
        return React.createElement(Icon, { size: "lg", name: "edit" });
    }
    return React.createElement(Icon, { size: "lg", name: "eye" });
}
function ItemDescription(_a) {
    var item = _a.item;
    if (item.userId) {
        return React.createElement("span", { className: "filter-table__weak-italic" }, "(User)");
    }
    if (item.teamId) {
        return React.createElement("span", { className: "filter-table__weak-italic" }, "(Team)");
    }
    return React.createElement("span", { className: "filter-table__weak-italic" }, "(Role)");
}
var PermissionsListItem = /** @class */ (function (_super) {
    __extends(PermissionsListItem, _super);
    function PermissionsListItem() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onPermissionChanged = function (option) {
            _this.props.onPermissionChanged(_this.props.item, option.value);
        };
        _this.onRemoveItem = function () {
            _this.props.onRemoveItem(_this.props.item);
        };
        return _this;
    }
    PermissionsListItem.prototype.render = function () {
        var _a = this.props, item = _a.item, folderInfo = _a.folderInfo;
        var inheritedFromRoot = item.dashboardId === -1 && !item.inherited;
        var currentPermissionLevel = dashboardPermissionLevels.find(function (dp) { return dp.value === item.permission; });
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
                    React.createElement("a", { className: "text-link", href: folderInfo.url + "/permissions" }, folderInfo.title),
                    ' ')),
                inheritedFromRoot && React.createElement("em", { className: "muted no-wrap" }, "Default Permission")),
            React.createElement("td", { className: "query-keyword" }, "Can"),
            React.createElement("td", null,
                React.createElement(Select, { "aria-label": "Permission level for \"" + item.name + "\"", isSearchable: false, options: dashboardPermissionLevels, onChange: this.onPermissionChanged, disabled: item.inherited, value: currentPermissionLevel, width: 25, menuShouldPortal: true })),
            React.createElement("td", null, !item.inherited ? (React.createElement(Button, { "aria-label": "Remove permission for \"" + item.name + "\"", size: "sm", variant: "destructive", icon: "times", onClick: this.onRemoveItem })) : (React.createElement(Button, { "aria-label": "Remove permission for \"" + item.name + "\" (Disabled)", size: "sm", disabled: true, icon: "times" })))));
    };
    return PermissionsListItem;
}(PureComponent));
export default PermissionsListItem;
//# sourceMappingURL=PermissionListItem.js.map