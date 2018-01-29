import React, { Component } from 'react';
import { store } from 'app/stores/store';
import Permissions from 'app/core/components/Permissions/Permissions';

export interface IProps {
  dashboardId: number;
  folderTitle: string;
  backendSrv: any;
}

class DashboardPermissions extends Component<IProps, any> {
  permissions: any;

  constructor(props) {
    super(props);
    this.permissions = store.permissions;
  }

  render() {
    const { dashboardId, folderTitle, backendSrv } = this.props;

    return (
      <Permissions
        permissions={this.permissions}
        isFolder={false}
        dashboardId={dashboardId}
        folderTitle={folderTitle}
        backendSrv={backendSrv}
      />
    );
  }
}

export default DashboardPermissions;
