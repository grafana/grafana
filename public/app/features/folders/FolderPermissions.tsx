import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import { connect } from 'react-redux';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import Permissions from 'app/core/components/Permissions/Permissions';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import PermissionsInfo from 'app/core/components/Permissions/PermissionsInfo';
import AddPermissions from 'app/core/components/Permissions/AddPermissions';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel, StoreState, FolderState } from 'app/types';
import { getFolderByUid } from './state/actions';
import { PermissionsStore } from 'app/stores/PermissionsStore/PermissionsStore';
import { getLoadingNav } from './state/navModel';

export interface Props {
  navModel: NavModel;
  getFolderByUid: typeof getFolderByUid;
  folderUid: string;
  folder: FolderState;
  permissions: typeof PermissionsStore.Type;
  backendSrv: any;
}

@inject('permissions')
@observer
export class FolderPermissions extends Component<Props> {
  constructor(props) {
    super(props);
    this.handleAddPermission = this.handleAddPermission.bind(this);
  }

  componentDidMount() {
    this.props.getFolderByUid(this.props.folderUid);
  }

  componentWillUnmount() {
    const { permissions } = this.props;
    permissions.hideAddPermissions();
  }

  handleAddPermission() {
    const { permissions } = this.props;
    permissions.toggleAddPermissions();
  }

  render() {
    const { navModel, permissions, backendSrv, folder } = this.props;

    if (folder.id === 0) {
      return <PageHeader model={navModel} />;
    }

    const dashboardId = folder.id;

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
            <button
              className="btn btn-success pull-right"
              onClick={this.handleAddPermission}
              disabled={permissions.isAddPermissionsVisible}
            >
              <i className="fa fa-plus" /> Add Permission
            </button>
          </div>
          <SlideDown in={permissions.isAddPermissionsVisible}>
            <AddPermissions permissions={permissions} />
          </SlideDown>
          <Permissions permissions={permissions} isFolder={true} dashboardId={dashboardId} backendSrv={backendSrv} />
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
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(FolderPermissions));
