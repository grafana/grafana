import React, { Component } from 'react';
import PermissionsList from './PermissionsList';
import _ from 'lodash';
import DevTools from 'mobx-react-devtools';
import { inject, observer } from 'mobx-react';
import { Provider } from 'mobx-react';
import { store } from 'app/stores/store';

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
  error: any;
  newType: any;
  aclTypes: any;
  backendSrv: any;
  dashboardId: number;
  permissions: any;
}

class Permissions extends Component<IProps, any> {
  render() {
    return (
      <Provider {...store}>
        <PermissionsInner {...this.props} />
      </Provider>
    );
  }
}

@inject('permissions')
@observer
class PermissionsInner extends Component<IProps, any> {
  // TODO Remove Inner from Name when we get access via ReactContainer
  dashboardId: any;
  meta: any;
  items: DashboardAcl[];
  dummyItems: DashboardAcl[];
  permissionOptions = [{ value: 1, text: 'View' }, { value: 2, text: 'Edit' }, { value: 4, text: 'Admin' }];
  backendSrv: any;
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

    const { dashboardId, backendSrv, permissions } = this.props;

    this.dashboardId = dashboardId;
    this.backendSrv = backendSrv;
    this.permissionChanged = this.permissionChanged.bind(this);
    this.typeChanged = this.typeChanged.bind(this);
    this.removeItem = this.removeItem.bind(this);
    permissions.load(this.dashboardId);

    this.state = {
      newType: 'Group',
      canUpdate: false,
      error: '',
    };
  }

  sortItems(items) {
    return _.orderBy(items, ['sortRank', 'sortName'], ['desc', 'asc']);
  }

  permissionChanged(evt) {
    // TODO
  }

  removeItem(index) {
    const { permissions } = this.props;
    permissions.removeStoreItem(index);
  }

  update() {
    var updated = [];
    for (let item of this.state.items) {
      if (item.inherited) {
        continue;
      }
      updated.push({
        id: item.id,
        userId: item.userId,
        teamId: item.teamId,
        role: item.role,
        permission: item.permission,
      });
    }

    return this.backendSrv
      .post(`/api/dashboards/id/${this.dashboardId}/acl`, {
        items: updated,
      })
      .then(() => {
        this.setState(prevState => {
          return {
            ...prevState,
            canUpdate: false,
          };
        });
      });
  }

  prepareViewModel(item: DashboardAcl): DashboardAcl {
    // TODO: this.meta
    // item.inherited = !this.meta.isFolder && this.dashboardId !== item.dashboardId;
    item.inherited = this.dashboardId !== item.dashboardId;
    item.sortRank = 0;
    if (item.userId > 0) {
      item.icon = 'fa fa-fw fa-user';
      //   item.nameHtml = this.$sce.trustAsHtml(item.userLogin);
      item.nameHtml = item.userLogin;
      item.sortName = item.userLogin;
      item.sortRank = 10;
    } else if (item.teamId > 0) {
      item.icon = 'fa fa-fw fa-users';
      //   item.nameHtml = this.$sce.trustAsHtml(item.team);
      item.nameHtml = item.team;
      item.sortName = item.team;
      item.sortRank = 20;
    } else if (item.role) {
      item.icon = 'fa fa-fw fa-street-view';
      //   item.nameHtml = this.$sce.trustAsHtml(`Everyone with <span class="query-keyword">${item.role}</span> Role`);
      item.nameHtml = `Everyone with <span class="query-keyword">${item.role}</span> Role`;
      item.sortName = item.role;
      item.sortRank = 30;
      if (item.role === 'Viewer') {
        item.sortRank += 1;
      }
    }

    if (item.inherited) {
      item.sortRank += 100;
    }

    return item;
  }

  isDuplicate(origItem, newItem) {
    if (origItem.inherited) {
      return false;
    }

    return (
      (origItem.role && newItem.role && origItem.role === newItem.role) ||
      (origItem.userId && newItem.userId && origItem.userId === newItem.userId) ||
      (origItem.teamId && newItem.teamId && origItem.teamId === newItem.teamId)
    );
  }

  isValid(item) {
    const dupe = _.find(this.items, it => {
      return this.isDuplicate(it, item);
    });

    if (dupe) {
      this.error = this.duplicateError;
      return false;
    }

    return true;
  }

  addNewItem(item) {
    if (!this.isValid(item)) {
      return;
    }
    this.error = '';

    item.dashboardId = this.dashboardId;

    let newItems = this.state.items;
    newItems.push(this.prepareViewModel(item));

    this.setState(prevState => {
      return {
        ...prevState,
        items: this.sortItems(newItems),
        canUpdate: true,
      };
    });
  }

  resetNewType() {
    this.setState(prevState => {
      return {
        newType: 'Group',
      };
    });
  }

  typeChanged(evt) {
    const { value } = evt.target;
    this.setState(prevState => {
      return {
        ...prevState,
        newType: value,
      };
    });
  }

  typeChanged___() {
    const { newType } = this.state;
    if (newType === 'Viewer' || newType === 'Editor') {
      this.addNewItem({ permission: 1, role: newType });
      this.resetNewType();
      this.setState(prevState => {
        return {
          ...prevState,
          canUpdate: true,
        };
      });
    }
  }

  render() {
    const { error, aclTypes, permissions } = this.props;
    const { newType } = this.state;

    return (
      <div className="gf-form-group">
        <PermissionsList
          permissions={permissions.items.toJS()}
          permissionsOptions={this.permissionOptions}
          removeItem={this.removeItem}
          permissionChanged={this.permissionChanged}
        />
        asd2
        <div className="gf-form-inline">
          <form name="addPermission" className="gf-form-group">
            <h6 className="muted">Add Permission For</h6>
            <div className="gf-form-inline">
              <div className="gf-form">
                <div className="gf-form-select-wrapper">
                  <select className="gf-form-input gf-size-auto" onChange={this.typeChanged}>
                    {aclTypes.map((option, idx) => {
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
              {newType === 'User' ? (
                <div className="gf-form">
                  {' '}
                  User picker
                  <user-picker user-picked="ctrl.userPicked($user)" />
                </div>
              ) : null}

              {newType === 'Group' ? (
                <div className="gf-form">
                  {' '}
                  Team picker
                  <team-picker team-picked="ctrl.groupPicked($group)" />
                </div>
              ) : null}
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
        asd3
        <DevTools />
      </div>
    );
  }
}

export default Permissions;
