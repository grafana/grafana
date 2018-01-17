import React, { Component } from 'react';
import PermissionsList from './PermissionsList';
import _ from 'lodash';
import DevTools from 'mobx-react-devtools';
import { inject, observer } from 'mobx-react';
// import UserPicker from 'app/core/components/UserPicker/UserPicker';

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
  newType: string;
  dashboardId: number;
  permissions?: any;
  isFolder: boolean;
}

@inject('permissions')
@observer
class Permissions extends Component<IProps, any> {
  // TODO Remove Inner from Name when we get access via ReactContainer
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

  readonly duplicateError = 'This permission exists already.';

  constructor(props) {
    super(props);
    const { dashboardId, permissions, isFolder } = this.props;
    this.permissionChanged = this.permissionChanged.bind(this);
    this.typeChanged = this.typeChanged.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.update = this.update.bind(this);
    permissions.load(dashboardId, isFolder);

    this.state = {
      newType: 'Group',
    };
  }

  componentWillReceiveProps(nextProps) {
    console.log('nextProps', nextProps);
  }

  sortItems(items) {
    return _.orderBy(items, ['sortRank', 'sortName'], ['desc', 'asc']);
  }

  permissionChanged(index: number, permission: number, permissionName: string) {
    const { permissions } = this.props;
    // permissions.items[index].updatePermission(permission, permissionName);
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

  render() {
    console.log('Permissions render');
    const { error, permissions } = this.props;
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

                  {/* <select
                    className="gf-form-input gf-size-auto"
                    ng-model="ctrl.newType"
                    ng-options="p.value as p.text for p in ctrl.aclTypes"
                    ng-change="ctrl.typeChanged()"
                  /> */}
                </div>
              </div>
              {/*
              {newType === 'User' ? (
                <div className="gf-form">
                  {' '}
                  User picker
                  <user-picker user-picked="ctrl.userPicked($user)" />
                  <select-user-picker
                    backendSrv="ctrl.backendSrv"
                    teamId="ctrl.$routeParams.id"
                    refreshList="ctrl.get"
                    teamMembers="ctrl.teamMembers"
                  />
                  <UserPicker backendSrv={backendSrv} teamId={0} />
                </div>
              ) : null}

              {newType === 'Group' ? (
                <div className="gf-form">
                  {' '}
                  Team picker
                  <team-picker team-picked="ctrl.groupPicked($group)" />
                </div>
              ) : null}
              */}
            </div>
          </form>
          {error ? (
            <div className="gf-form width-17">
              <span ng-if="ctrl.error" className="text-error p-l-1">
                <i className="fa fa-warning" />
                {error}
              </span>
            </div>
          ) : null}
        </div>
        <div className="gf-form-button-row">
          <button type="button" className="btn btn-danger" onClick={this.update} disabled={!permissions.canUpdate}>
            Update Permissions
          </button>
        </div>
        <DevTools />
      </div>
    );
  }
}

export default Permissions;
