import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Tooltip, Icon, Button } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { Page } from 'app/core/components/Page/Page';
import AddPermission from 'app/core/components/PermissionList/AddPermission';
import PermissionList from 'app/core/components/PermissionList/PermissionList';
import PermissionsInfo from 'app/core/components/PermissionList/PermissionsInfo';
import { getNavModel } from 'app/core/selectors/navModel';
import { getFolderByUid, getFolderPermissions, updateFolderPermission, removeFolderPermission, addFolderPermission, } from './state/actions';
import { getLoadingNav } from './state/navModel';
const mapStateToProps = (state, props) => {
    const uid = props.match.params.uid;
    return {
        pageNav: getNavModel(state.navIndex, `folder-permissions-${uid}`, getLoadingNav(1)),
        folderUid: uid,
        folder: state.folder,
    };
};
const mapDispatchToProps = {
    getFolderByUid,
    getFolderPermissions,
    updateFolderPermission,
    removeFolderPermission,
    addFolderPermission,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class FolderPermissions extends PureComponent {
    constructor(props) {
        super(props);
        this.onOpenAddPermissions = () => {
            this.setState({ isAdding: true });
        };
        this.onRemoveItem = (item) => {
            this.props.removeFolderPermission(item);
        };
        this.onPermissionChanged = (item, level) => {
            this.props.updateFolderPermission(item, level);
        };
        this.onAddPermission = (newItem) => {
            return this.props.addFolderPermission(newItem);
        };
        this.onCancelAddPermission = () => {
            this.setState({ isAdding: false });
        };
        this.state = {
            isAdding: false,
        };
    }
    componentDidMount() {
        this.props.getFolderByUid(this.props.folderUid);
        this.props.getFolderPermissions(this.props.folderUid);
    }
    render() {
        const { pageNav, folder } = this.props;
        const { isAdding } = this.state;
        if (folder.id === 0) {
            return (React.createElement(Page, { navId: "dashboards/browse", pageNav: pageNav.main },
                React.createElement(Page.Contents, { isLoading: true },
                    React.createElement("span", null))));
        }
        const folderInfo = { title: folder.title, url: folder.url, id: folder.id };
        return (React.createElement(Page, { navId: "dashboards/browse", pageNav: pageNav.main },
            React.createElement(Page.Contents, null,
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("h3", { className: "page-sub-heading" }, "Folder Permissions"),
                    React.createElement(Tooltip, { placement: "auto", content: React.createElement(PermissionsInfo, null) },
                        React.createElement(Icon, { className: "icon--has-hover page-sub-heading-icon", name: "question-circle" })),
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    React.createElement(Button, { className: "pull-right", onClick: this.onOpenAddPermissions, disabled: isAdding }, "Add Permission")),
                React.createElement(SlideDown, { in: isAdding },
                    React.createElement(AddPermission, { onAddPermission: this.onAddPermission, onCancel: this.onCancelAddPermission })),
                React.createElement(PermissionList, { items: folder.permissions, onRemoveItem: this.onRemoveItem, onPermissionChanged: this.onPermissionChanged, isFetching: false, folderInfo: folderInfo }))));
    }
}
export default connector(FolderPermissions);
//# sourceMappingURL=FolderPermissions.js.map