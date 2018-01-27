import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { store } from 'app/stores/store';
import Permissions from 'app/core/components/Permissions/Permissions';

export interface IProps {
  dashboardId: number;
  backendSrv: any;
}

@observer
class DashboardPermissions extends Component<IProps, any> {
  permissions: any;

  constructor(props) {
    super(props);
    this.permissions = store.permissions;
  }

  render() {
    const { dashboardId, backendSrv } = this.props;

    return (
      <Permissions permissions={this.permissions} isFolder={false} dashboardId={dashboardId} backendSrv={backendSrv} />
    );
  }
}

export default DashboardPermissions;
