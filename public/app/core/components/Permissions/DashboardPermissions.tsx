import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { store } from 'app/stores/store';
import Permissions from 'app/core/components/Permissions/Permissions';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import PermissionsInfo from 'app/core/components/Permissions/PermissionsInfo';
import AddPermissions from 'app/core/components/Permissions/AddPermissions';
import SlideDown from 'app/core/components/Animations/SlideDown';

export interface IProps {
  dashboardId: number;
  folderId: number;
  folderTitle: string;
  folderSlug: string;
  backendSrv: any;
}
@observer
class DashboardPermissions extends Component<IProps, any> {
  permissions: any;

  constructor(props) {
    super(props);
    this.handleAddPermission = this.handleAddPermission.bind(this);
    this.permissions = store.permissions;
  }

  handleAddPermission() {
    this.permissions.toggleAddPermissions();
  }

  render() {
    const { dashboardId, folderTitle, folderSlug, folderId, backendSrv } = this.props;

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
          <AddPermissions permissions={this.permissions} backendSrv={backendSrv} dashboardId={dashboardId} />
        </SlideDown>
        <Permissions
          permissions={this.permissions}
          isFolder={false}
          dashboardId={dashboardId}
          folderInfo={{ title: folderTitle, slug: folderSlug, id: folderId }}
          backendSrv={backendSrv}
        />
      </div>
    );
  }
}

export default DashboardPermissions;
