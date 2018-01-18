import React, { Component } from 'react';
import PermissionsList from './PermissionsList';
import { observer } from 'mobx-react';
import UserPicker, { User } from 'app/core/components/Picker/UserPicker';
import TeamPicker, { Team } from 'app/core/components/Picker/TeamPicker';

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
  error: string;
  dashboardId: number;
  permissions?: any;
  isFolder: boolean;
  backendSrv: any;
}

@observer
class Permissions extends Component<IProps, any> {
  dashboardId: any;
  meta: any;
  items: DashboardAcl[];
  dummyItems: DashboardAcl[];
  permissionOptions = [{ value: 1, text: 'View' }, { value: 2, text: 'Edit' }, { value: 4, text: 'Admin' }];
  aclTypes = [
    { value: 'Group', text: 'Team' },
    { value: 'User', text: 'User' },
    { value: 'Viewer', text: 'Everyone With Viewer Role' },
    { value: 'Editor', text: 'Everyone With Editor Role' },
  ];
  newType: string;
  canUpdate: boolean;
  error: string;
  refreshList: any;

  constructor(props) {
    super(props);
    const { dashboardId, permissions, isFolder } = this.props;
    this.permissionChanged = this.permissionChanged.bind(this);
    this.typeChanged = this.typeChanged.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.update = this.update.bind(this);
    this.userPicked = this.userPicked.bind(this);
    this.teamPicked = this.teamPicked.bind(this);
    permissions.load(dashboardId, isFolder);

    this.state = {
      newType: 'Group',
    };
  }

  permissionChanged(index: number, permission: number, permissionName: string) {
    const { permissions } = this.props;
    permissions.updatePermissionOnIndex(index, permission, permissionName);
  }

  removeItem(index: number) {
    const { permissions } = this.props;
    permissions.removeStoreItem(index);
  }

  update() {
    const { permissions, dashboardId } = this.props;
    permissions.update(dashboardId);
  }

  resetNewType() {
    this.setState(prevState => {
      return {
        ...prevState,
        newType: 'Group',
      };
    });
  }

  typeChanged(evt) {
    const { value } = evt.target;
    const { permissions, dashboardId } = this.props;

    if (value === 'Viewer' || value === 'Editor') {
      permissions.addStoreItem({ permission: 1, role: value, dashboardId: dashboardId }, dashboardId);
      this.resetNewType();
      return;
    }

    this.setState(prevState => {
      return {
        ...prevState,
        newType: value,
      };
    });
  }

  userPicked(user: User) {
    const { permissions } = this.props;
    permissions.addStoreItem({ userId: user.id, userLogin: user.login, permission: 1 });
  }

  teamPicked(team: Team) {
    const { permissions } = this.props;
    permissions.addStoreItem({ teamId: team.id, team: team.name, permission: 1 });
  }

  render() {
    console.log('Permissions render');
    const { permissions, backendSrv } = this.props;
    const { newType } = this.state;

    return (
      <div className="gf-form-group">
        <PermissionsList
          permissions={permissions.items}
          permissionsOptions={this.permissionOptions}
          removeItem={this.removeItem}
          permissionChanged={this.permissionChanged}
          fetching={permissions.fetching}
        />
        <div className="gf-form-inline">
          <form name="addPermission" className="gf-form-group">
            <h6 className="muted">Add Permission For</h6>
            <div className="gf-form-inline">
              <div className="gf-form">
                <div className="gf-form-select-wrapper">
                  <select className="gf-form-input gf-size-auto" value={newType} onChange={this.typeChanged}>
                    {this.aclTypes.map((option, idx) => {
                      return (
                        <option key={idx} value={option.value}>
                          {option.text}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {newType === 'User' ? (
                <div className="gf-form">
                  <UserPicker backendSrv={backendSrv} handlePicked={this.userPicked} />
                </div>
              ) : null}

              {newType === 'Group' ? (
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
        <div className="gf-form-button-row">
          <button type="button" className="btn btn-danger" onClick={this.update} disabled={!permissions.canUpdate}>
            Update Permissions
          </button>
        </div>
        <div className="empty-list-cta m-t-3">
          <div className="grafana-info-box">
            <h5>What are Permissions?</h5>
            <p>
              An Access Control List (ACL) model is used for to limit access to Dashboard Folders. A user or a Team can
              be assigned permissions for a folder or for a single dashboard.
            </p>
            <p>The permissions that can be assigned for a folder/dashboard are:</p>
            <p>View, Edit and Admin.</p>
            Checkout the{' '}
            <a className="external-link" target="_blank" href="http://docs.grafana.org/reference/dashboard_folders/">
              Dashboard Folders documentation
            </a>{' '}
            for more information.
          </div>
        </div>
      </div>
    );
  }
}

export default Permissions;
