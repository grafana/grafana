import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { store } from 'app/stores/store';
import Permissions from 'app/core/components/Permissions/Permissions';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import PermissionsInfo from 'app/core/components/Permissions/PermissionsInfo';
import AddPermissions from 'app/core/components/Permissions/AddPermissions';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { FolderInfo } from './FolderInfo';

export interface Props {
  dashboardId: number;
  folder?: FolderInfo;
  backendSrv: any;
}

@observer
class DashboardPermissions extends Component<Props, any> {
  permissions: any;

  constructor(props) {
    super(props);
    this.handleAddPermission = this.handleAddPermission.bind(this);
    this.permissions = store.permissions;
  }

  handleAddPermission() {
    this.permissions.toggleAddPermissions();
  }

  componentWillUnmount() {
    this.permissions.hideAddPermissions();
  }

  render() {
    const { dashboardId, folder, backendSrv } = this.props;

    return (
      <div>
        <div className="dashboard-settings__header">
          <div className="page-action-bar">
            <h3 className="d-inline-block">Permissions</h3>
            <Tooltip className="page-sub-heading-icon" placement="auto" content={PermissionsInfo}>
              <i className="gicon gicon-question gicon--has-hover" />
            </Tooltip>
            <div className="page-action-bar__spacer" />
            <button
              className="btn btn-success pull-right"
              onClick={this.handleAddPermission}
              disabled={this.permissions.isAddPermissionsVisible}
            >
              <i className="fa fa-plus" /> Add Permission
            </button>
          </div>
        </div>
        <SlideDown in={this.permissions.isAddPermissionsVisible}>
          <AddPermissions permissions={this.permissions} />
        </SlideDown>
        <Permissions
          permissions={this.permissions}
          isFolder={false}
          dashboardId={dashboardId}
          folderInfo={folder}
          backendSrv={backendSrv}
        />
      </div>
    );
  }
}

export default DashboardPermissions;
