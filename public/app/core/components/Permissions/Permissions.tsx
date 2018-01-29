import React, { Component } from 'react';
import PermissionsList from './PermissionsList';
import { observer } from 'mobx-react';
import UserPicker, { User } from 'app/core/components/Picker/UserPicker';
import TeamPicker, { Team } from 'app/core/components/Picker/TeamPicker';
import { aclTypes } from 'app/stores/PermissionsStore/PermissionsStore';

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
  nameHtml?: string;
  inherited?: boolean;
  sortName?: string;
  sortRank?: number;
}

export interface IProps {
  dashboardId: number;
  folderTitle?: string;
  permissions?: any;
  isFolder: boolean;
  backendSrv: any;
}

@observer
class Permissions extends Component<IProps, any> {
  constructor(props) {
    super(props);
    const { dashboardId, isFolder } = this.props;
    this.permissionChanged = this.permissionChanged.bind(this);
    this.typeChanged = this.typeChanged.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.userPicked = this.userPicked.bind(this);
    this.teamPicked = this.teamPicked.bind(this);
    this.loadStore(dashboardId, isFolder);
  }

  loadStore(dashboardId, isFolder) {
    return this.props.permissions.load(dashboardId, isFolder);
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

  userPicked(user: User) {
    const { permissions } = this.props;
    return permissions.addStoreItem({ userId: user.id, userLogin: user.login, permission: 1 });
  }

  teamPicked(team: Team) {
    const { permissions } = this.props;
    return permissions.addStoreItem({ teamId: team.id, team: team.name, permission: 1 });
  }

  render() {
    const { permissions, folderTitle, backendSrv } = this.props;

    return (
      <div className="gf-form-group">
        <PermissionsList
          permissions={permissions.items}
          removeItem={this.removeItem}
          permissionChanged={this.permissionChanged}
          fetching={permissions.fetching}
          folderTitle={folderTitle}
        />
        <div className="gf-form-inline">
          <form name="addPermission" className="gf-form-group">
            <h6 className="muted">Add Permission For</h6>
            <div className="gf-form-inline">
              <div className="gf-form">
                <div className="gf-form-select-wrapper">
                  <select
                    className="gf-form-input gf-size-auto"
                    value={permissions.newType}
                    onChange={this.typeChanged}
                  >
                    {aclTypes.map((option, idx) => {
                      return (
                        <option key={idx} value={option.value}>
                          {option.text}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {permissions.newType === 'User' ? (
                <div className="gf-form">
                  <UserPicker backendSrv={backendSrv} handlePicked={this.userPicked} />
                </div>
              ) : null}

              {permissions.newType === 'Group' ? (
                <div className="gf-form">
                  <TeamPicker backendSrv={backendSrv} handlePicked={this.teamPicked} />
                </div>
              ) : null}
            </div>
          </form>
          {permissions.error ? (
            <div className="gf-form width-17">
              <span ng-if="ctrl.error" className="text-error p-l-1">
                <i className="fa fa-warning" />
                {permissions.error}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

export default Permissions;
