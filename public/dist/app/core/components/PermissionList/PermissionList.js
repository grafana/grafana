import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import PermissionsListItem from './PermissionListItem';
import DisabledPermissionsListItem from './DisabledPermissionListItem';
var PermissionList = /** @class */ (function (_super) {
    tslib_1.__extends(PermissionList, _super);
    function PermissionList() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PermissionList.prototype.render = function () {
        var _a = this.props, items = _a.items, onRemoveItem = _a.onRemoveItem, onPermissionChanged = _a.onPermissionChanged, isFetching = _a.isFetching, folderInfo = _a.folderInfo;
        return (React.createElement("table", { className: "filter-table gf-form-group" },
            React.createElement("tbody", null,
                React.createElement(DisabledPermissionsListItem, { key: 0, item: {
                        name: 'Admin',
                        permission: 4,
                        icon: 'fa fa-fw fa-street-view',
                    } }),
                items.map(function (item, idx) {
                    return (React.createElement(PermissionsListItem, { key: idx + 1, item: item, onRemoveItem: onRemoveItem, onPermissionChanged: onPermissionChanged, folderInfo: folderInfo }));
                }),
                isFetching === true && items.length < 1 ? (React.createElement("tr", null,
                    React.createElement("td", { colSpan: 4 },
                        React.createElement("em", null, "Loading permissions...")))) : null,
                isFetching === false && items.length < 1 ? (React.createElement("tr", null,
                    React.createElement("td", { colSpan: 4 },
                        React.createElement("em", null, "No permissions are set. Will only be accessible by admins.")))) : null)));
    };
    return PermissionList;
}(PureComponent));
export default PermissionList;
//# sourceMappingURL=PermissionList.js.map