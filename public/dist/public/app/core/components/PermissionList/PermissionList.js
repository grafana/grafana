import React, { PureComponent } from 'react';
import DisabledPermissionsListItem from './DisabledPermissionListItem';
import PermissionsListItem from './PermissionListItem';
class PermissionList extends PureComponent {
    render() {
        const { items, onRemoveItem, onPermissionChanged, isFetching, folderInfo } = this.props;
        return (React.createElement("table", { className: "filter-table gf-form-group" },
            React.createElement("tbody", null,
                React.createElement(DisabledPermissionsListItem, { key: 0, item: {
                        name: 'Admin',
                        permission: 4,
                    } }),
                items.map((item, idx) => {
                    return (React.createElement(PermissionsListItem, { key: idx + 1, item: item, onRemoveItem: onRemoveItem, onPermissionChanged: onPermissionChanged, folderInfo: folderInfo }));
                }),
                isFetching === true && items.length < 1 ? (React.createElement("tr", null,
                    React.createElement("td", { colSpan: 4 },
                        React.createElement("em", null, "Loading permissions...")))) : null,
                isFetching === false && items.length < 1 ? (React.createElement("tr", null,
                    React.createElement("td", { colSpan: 4 },
                        React.createElement("em", null, "No permissions are set. Will only be accessible by admins.")))) : null)));
    }
}
export default PermissionList;
//# sourceMappingURL=PermissionList.js.map