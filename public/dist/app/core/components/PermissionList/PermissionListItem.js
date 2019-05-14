import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { Select } from '@grafana/ui';
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
        return React.createElement("i", { style: { width: '25px', height: '25px' }, className: "gicon gicon-editor" });
    }
    return React.createElement("i", { style: { width: '25px', height: '25px' }, className: "gicon gicon-viewer" });
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
    tslib_1.__extends(PermissionsListItem, _super);
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
        return (React.createElement("tr", { className: setClassNameHelper(item.inherited) },
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
                React.createElement("div", { className: "gf-form" },
                    React.createElement(Select, { isSearchable: false, options: dashboardPermissionLevels, onChange: this.onPermissionChanged, isDisabled: item.inherited, className: "gf-form-select-box__control--menu-right", value: currentPermissionLevel }))),
            React.createElement("td", null, !item.inherited ? (React.createElement("a", { className: "btn btn-danger btn-small", onClick: this.onRemoveItem },
                React.createElement("i", { className: "fa fa-remove" }))) : (React.createElement("button", { className: "btn btn-inverse btn-small" },
                React.createElement("i", { className: "fa fa-lock" }))))));
    };
    return PermissionsListItem;
}(PureComponent));
export default PermissionsListItem;
//# sourceMappingURL=PermissionListItem.js.map