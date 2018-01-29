import React, { Component } from 'react';
import { store } from 'app/stores/store';
import Permissions from 'app/core/components/Permissions/Permissions';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import PermissionsInfo from 'app/core/components/Permissions/PermissionsInfo';

export interface IProps {
  dashboardId: number;
  folderId: number;
  folderTitle: string;
  folderSlug: string;
  backendSrv: any;
}

class DashboardPermissions extends Component<IProps, any> {
  permissions: any;

  constructor(props) {
    super(props);
    this.permissions = store.permissions;
  }

  render() {
    const { dashboardId, folderTitle, folderSlug, folderId, backendSrv } = this.props;

    return (
      <div>
        <div className="dashboard-settings__header">
          <h3 className="d-inline-block">Permissions</h3>
          <Tooltip className="page-sub-heading-icon" placement="auto" content={PermissionsInfo}>
            <i className="gicon gicon-question gicon--has-hover" />
          </Tooltip>
        </div>
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
