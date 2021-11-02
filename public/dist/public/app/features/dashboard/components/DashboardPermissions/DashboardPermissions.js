import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Tooltip, Icon, Button } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { getDashboardPermissions, addDashboardPermission, removeDashboardPermission, updateDashboardPermission, } from '../../state/actions';
import PermissionList from 'app/core/components/PermissionList/PermissionList';
import AddPermission from 'app/core/components/PermissionList/AddPermission';
import PermissionsInfo from 'app/core/components/PermissionList/PermissionsInfo';
var mapStateToProps = function (state) { return ({
    permissions: state.dashboard.permissions,
}); };
var mapDispatchToProps = {
    getDashboardPermissions: getDashboardPermissions,
    addDashboardPermission: addDashboardPermission,
    removeDashboardPermission: removeDashboardPermission,
    updateDashboardPermission: updateDashboardPermission,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var DashboardPermissionsUnconnected = /** @class */ (function (_super) {
    __extends(DashboardPermissionsUnconnected, _super);
    function DashboardPermissionsUnconnected(props) {
        var _this = _super.call(this, props) || this;
        _this.onOpenAddPermissions = function () {
            _this.setState({ isAdding: true });
        };
        _this.onRemoveItem = function (item) {
            _this.props.removeDashboardPermission(_this.props.dashboard.id, item);
        };
        _this.onPermissionChanged = function (item, level) {
            _this.props.updateDashboardPermission(_this.props.dashboard.id, item, level);
        };
        _this.onAddPermission = function (newItem) {
            return _this.props.addDashboardPermission(_this.props.dashboard.id, newItem);
        };
        _this.onCancelAddPermission = function () {
            _this.setState({ isAdding: false });
        };
        _this.state = {
            isAdding: false,
        };
        return _this;
    }
    DashboardPermissionsUnconnected.prototype.componentDidMount = function () {
        this.props.getDashboardPermissions(this.props.dashboard.id);
    };
    DashboardPermissionsUnconnected.prototype.getFolder = function () {
        var dashboard = this.props.dashboard;
        return {
            id: dashboard.meta.folderId,
            title: dashboard.meta.folderTitle,
            url: dashboard.meta.folderUrl,
        };
    };
    DashboardPermissionsUnconnected.prototype.render = function () {
        var _a = this.props, permissions = _a.permissions, hasUnsavedFolderChange = _a.dashboard.meta.hasUnsavedFolderChange;
        var isAdding = this.state.isAdding;
        return hasUnsavedFolderChange ? (React.createElement("h5", null, "You have changed a folder, please save to view permissions.")) : (React.createElement("div", null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("h3", { className: "page-sub-heading" }, "Permissions"),
                React.createElement(Tooltip, { placement: "auto", content: React.createElement(PermissionsInfo, null) },
                    React.createElement(Icon, { className: "icon--has-hover page-sub-heading-icon", name: "question-circle" })),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                React.createElement(Button, { className: "pull-right", onClick: this.onOpenAddPermissions, disabled: isAdding }, "Add permission")),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement(AddPermission, { onAddPermission: this.onAddPermission, onCancel: this.onCancelAddPermission })),
            React.createElement(PermissionList, { items: permissions, onRemoveItem: this.onRemoveItem, onPermissionChanged: this.onPermissionChanged, isFetching: false, folderInfo: this.getFolder() })));
    };
    return DashboardPermissionsUnconnected;
}(PureComponent));
export { DashboardPermissionsUnconnected };
export var DashboardPermissions = connector(DashboardPermissionsUnconnected);
//# sourceMappingURL=DashboardPermissions.js.map