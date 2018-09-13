import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import Permissions from 'app/core/components/Permissions/Permissions';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import PermissionsInfo from 'app/core/components/Permissions/PermissionsInfo';
import AddPermissions from 'app/core/components/Permissions/AddPermissions';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel, StoreState, FolderState, DashboardAcl, PermissionLevel } from 'app/types';
import { getFolderByUid, getFolderPermissions, updateFolderPermission, removeFolderPermission } from './state/actions';
import { getLoadingNav } from './state/navModel';
import PermissionList from 'app/core/components/PermissionList/PermissionList';

export interface Props {
  navModel: NavModel;
  folderUid: string;
  folder: FolderState;
  getFolderByUid: typeof getFolderByUid;
  getFolderPermissions: typeof getFolderPermissions;
  updateFolderPermission: typeof updateFolderPermission;
  removeFolderPermission: typeof removeFolderPermission;
}

export interface State {
  isAdding: boolean;
}

export class FolderPermissions extends Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      isAdding: false,
    };
  }

  componentDidMount() {
    this.props.getFolderByUid(this.props.folderUid);
    this.props.getFolderPermissions(this.props.folderUid);
  }

  onOpenAddPermissions = () => {
    this.setState({ isAdding: true });
  };

  onRemoveItem = (item: DashboardAcl) => {
    this.props.removeFolderPermission(item);
  };

  onPermissionChanged = (item: DashboardAcl, level: PermissionLevel) => {
    this.props.updateFolderPermission(item, level);
  };

  render() {
    const { navModel, folder } = this.props;
    const { isAdding } = this.state;

    if (folder.id === 0) {
      return <PageHeader model={navModel} />;
    }

    const dashboardId = folder.id;
    const folderInfo = { title: folder.tile, url: folder.url, id: folder.id };

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <h3 className="page-sub-heading">Folder Permissions</h3>
            <Tooltip className="page-sub-heading-icon" placement="auto" content={PermissionsInfo}>
              <i className="gicon gicon-question gicon--has-hover" />
            </Tooltip>
            <div className="page-action-bar__spacer" />
            <button className="btn btn-success pull-right" onClick={this.onOpenAddPermissions} disabled={isAdding}>
              <i className="fa fa-plus" /> Add Permission
            </button>
          </div>
          <PermissionList
            items={folder.permissions}
            onRemoveItem={this.onRemoveItem}
            onPermissionChanged={this.onPermissionChanged}
            isFetching={false}
            folderInfo={folderInfo}
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  const uid = state.location.routeParams.uid;
  return {
    navModel: getNavModel(state.navIndex, `folder-permissions-${uid}`, getLoadingNav(1)),
    folderUid: uid,
    folder: state.folder,
  };
};

const mapDispatchToProps = {
  getFolderByUid,
  getFolderPermissions,
  updateFolderPermission,
  removeFolderPermission,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(FolderPermissions));
