import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { config } from '@grafana/runtime';
import { Tooltip, Icon, Button } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { Page } from 'app/core/components/Page/Page';
import AddPermission from 'app/core/components/PermissionList/AddPermission';
import PermissionList from 'app/core/components/PermissionList/PermissionList';
import PermissionsInfo from 'app/core/components/PermissionList/PermissionsInfo';
import { checkFolderPermissions } from '../../../folders/state/actions';
import { getDashboardPermissions, addDashboardPermission, removeDashboardPermission, updateDashboardPermission, } from '../../state/actions';
const mapStateToProps = (state) => ({
    permissions: state.dashboard.permissions,
    canViewFolderPermissions: state.folder.canViewFolderPermissions,
});
const mapDispatchToProps = {
    getDashboardPermissions,
    addDashboardPermission,
    removeDashboardPermission,
    updateDashboardPermission,
    checkFolderPermissions,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class DashboardPermissionsUnconnected extends PureComponent {
    constructor(props) {
        super(props);
        this.onOpenAddPermissions = () => {
            this.setState({ isAdding: true });
        };
        this.onRemoveItem = (item) => {
            this.props.removeDashboardPermission(this.props.dashboard.id, item);
        };
        this.onPermissionChanged = (item, level) => {
            this.props.updateDashboardPermission(this.props.dashboard.id, item, level);
        };
        this.onAddPermission = (newItem) => {
            return this.props.addDashboardPermission(this.props.dashboard.id, newItem);
        };
        this.onCancelAddPermission = () => {
            this.setState({ isAdding: false });
        };
        this.state = {
            isAdding: false,
        };
    }
    componentDidMount() {
        this.props.getDashboardPermissions(this.props.dashboard.id);
        if (this.props.dashboard.meta.folderUid) {
            this.props.checkFolderPermissions(this.props.dashboard.meta.folderUid);
        }
    }
    getFolder() {
        const { dashboard, canViewFolderPermissions } = this.props;
        return {
            id: dashboard.meta.folderId,
            title: dashboard.meta.folderTitle,
            url: dashboard.meta.folderUrl,
            canViewFolderPermissions,
        };
    }
    render() {
        const { permissions, dashboard, sectionNav } = this.props;
        const { isAdding } = this.state;
        const pageNav = config.featureToggles.dockedMegaMenu ? sectionNav.node.parentItem : undefined;
        if (dashboard.meta.hasUnsavedFolderChange) {
            return (React.createElement(Page, { navModel: sectionNav, pageNav: pageNav },
                React.createElement("h5", null, "You have changed a folder, please save to view permissions.")));
        }
        return (React.createElement(Page, { navModel: sectionNav, pageNav: pageNav },
            React.createElement("div", { className: "page-action-bar" },
                React.createElement(Tooltip, { placement: "auto", content: React.createElement(PermissionsInfo, null) },
                    React.createElement(Icon, { className: "icon--has-hover page-sub-heading-icon", name: "question-circle" })),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                React.createElement(Button, { className: "pull-right", onClick: this.onOpenAddPermissions, disabled: isAdding }, "Add permission")),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement(AddPermission, { onAddPermission: this.onAddPermission, onCancel: this.onCancelAddPermission })),
            React.createElement(PermissionList, { items: permissions, onRemoveItem: this.onRemoveItem, onPermissionChanged: this.onPermissionChanged, isFetching: false, folderInfo: this.getFolder() })));
    }
}
export const DashboardPermissions = connector(DashboardPermissionsUnconnected);
//# sourceMappingURL=DashboardPermissions.js.map