import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { Tooltip } from '@grafana/ui';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { getDashboardPermissions, addDashboardPermission, removeDashboardPermission, updateDashboardPermission, } from '../../state/actions';
import PermissionList from 'app/core/components/PermissionList/PermissionList';
import AddPermission from 'app/core/components/PermissionList/AddPermission';
import PermissionsInfo from 'app/core/components/PermissionList/PermissionsInfo';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
var DashboardPermissions = /** @class */ (function (_super) {
    tslib_1.__extends(DashboardPermissions, _super);
    function DashboardPermissions(props) {
        var _this = _super.call(this, props) || this;
        _this.onOpenAddPermissions = function () {
            _this.setState({ isAdding: true });
        };
        _this.onRemoveItem = function (item) {
            _this.props.removeDashboardPermission(_this.props.dashboardId, item);
        };
        _this.onPermissionChanged = function (item, level) {
            _this.props.updateDashboardPermission(_this.props.dashboardId, item, level);
        };
        _this.onAddPermission = function (newItem) {
            return _this.props.addDashboardPermission(_this.props.dashboardId, newItem);
        };
        _this.onCancelAddPermission = function () {
            _this.setState({ isAdding: false });
        };
        _this.state = {
            isAdding: false,
        };
        return _this;
    }
    DashboardPermissions.prototype.componentDidMount = function () {
        this.props.getDashboardPermissions(this.props.dashboardId);
    };
    DashboardPermissions.prototype.render = function () {
        var _a = this.props, permissions = _a.permissions, folder = _a.folder;
        var isAdding = this.state.isAdding;
        return (React.createElement("div", null,
            React.createElement("div", { className: "dashboard-settings__header" },
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("h3", { className: "d-inline-block" }, "Permissions"),
                    React.createElement(Tooltip, { placement: "auto", content: React.createElement(PermissionsInfo, null) },
                        React.createElement("div", { className: "page-sub-heading-icon" },
                            React.createElement("i", { className: "gicon gicon-question gicon--has-hover" }))),
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    React.createElement("button", { className: "btn btn-primary pull-right", onClick: this.onOpenAddPermissions, disabled: isAdding }, "Add Permission"))),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement(AddPermission, { onAddPermission: this.onAddPermission, onCancel: this.onCancelAddPermission })),
            React.createElement(PermissionList, { items: permissions, onRemoveItem: this.onRemoveItem, onPermissionChanged: this.onPermissionChanged, isFetching: false, folderInfo: folder })));
    };
    return DashboardPermissions;
}(PureComponent));
export { DashboardPermissions };
var mapStateToProps = function (state) { return ({
    permissions: state.dashboard.permissions,
}); };
var mapDispatchToProps = {
    getDashboardPermissions: getDashboardPermissions,
    addDashboardPermission: addDashboardPermission,
    removeDashboardPermission: removeDashboardPermission,
    updateDashboardPermission: updateDashboardPermission,
};
export default connectWithStore(DashboardPermissions, mapStateToProps, mapDispatchToProps);
//# sourceMappingURL=DashboardPermissions.js.map