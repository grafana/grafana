import React, { Component } from 'react';
import PermissionsList from './PermissionsList';
import { observer } from 'mobx-react';
import { FolderInfo } from './FolderInfo';

export interface DashboardAcl {
  id?: number;
  dashboardId?: number;
  userId?: number;
  userLogin?: string;
  userEmail?: string;
  teamId?: number;
  team?: string;
  permission?: number;
  permissionName?: string;
  role?: string;
  icon?: string;
  name?: string;
  inherited?: boolean;
  sortRank?: number;
}

export interface IProps {
  dashboardId: number;
  folderInfo?: FolderInfo;
  permissions?: any;
  isFolder: boolean;
  backendSrv: any;
}

@observer
class Permissions extends Component<IProps, any> {
  constructor(props) {
    super(props);
    const { dashboardId, isFolder, folderInfo } = this.props;
    this.permissionChanged = this.permissionChanged.bind(this);
    this.typeChanged = this.typeChanged.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.loadStore(dashboardId, isFolder, folderInfo && folderInfo.id === 0);
  }

  loadStore(dashboardId, isFolder, isInRoot = false) {
    return this.props.permissions.load(dashboardId, isFolder, isInRoot);
  }

  permissionChanged(index: number, permission: number, permissionName: string) {
    const { permissions } = this.props;
    permissions.updatePermissionOnIndex(index, permission, permissionName);
  }

  removeItem(index: number) {
    const { permissions } = this.props;
    permissions.removeStoreItem(index);
  }

  resetNewType() {
    const { permissions } = this.props;
    permissions.resetNewType();
  }

  typeChanged(evt) {
    const { value } = evt.target;
    const { permissions, dashboardId } = this.props;

    if (value === 'Viewer' || value === 'Editor') {
      permissions.addStoreItem({ permission: 1, role: value, dashboardId: dashboardId }, dashboardId);
      this.resetNewType();
      return;
    }

    permissions.setNewType(value);
  }

  render() {
    const { permissions, folderInfo } = this.props;

    return (
      <div className="gf-form-group">
        <PermissionsList
          permissions={permissions.items}
          removeItem={this.removeItem}
          permissionChanged={this.permissionChanged}
          fetching={permissions.fetching}
          folderInfo={folderInfo}
        />
      </div>
    );
  }
}

export default Permissions;
