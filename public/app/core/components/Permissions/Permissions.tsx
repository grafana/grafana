import React, { Component } from 'react';
import PermissionsList from './PermissionsList';
import _ from 'lodash';

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
  typeChanged: any;
  backendSrv: any;
  dashboardId: number;
}

class Permissions extends Component<IProps, any> {
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
    this.dashboardId = this.props.dashboardId;
    this.backendSrv = this.props.backendSrv;
    this.permissionChanged = this.permissionChanged.bind(this);
    console.log('this.setState', this.setState);

    this.state = {
      items: [],
      newType: '',
      canUpdate: false,
      error: '',
    };
  }

  componentWillMount() {
    this.getAcl(this.props.dashboardId);
  }

  getAcl(dashboardId: number) {
    return this.backendSrv.get(`/api/dashboards/id/${dashboardId}/acl`).then(result => {
      console.log('this', this.setState);
      const items = result.map(this.prepareViewModel.bind(this));
      // this.items = _.map(result, this.prepareViewModel.bind(this));
      this.setState(prevState => {
        return {
          ...prevState,
          items: this.sortItems(items),
        };
      });
    });
  }

  sortItems(items) {
    return _.orderBy(items, ['sortRank', 'sortName'], ['desc', 'asc']);
  }

  permissionChanged() {
    this.setState(prevState => {
      return {
        ...prevState,
        canUpdate: true,
      };
    });
  }

  removeItem(index) {
    this.setState(prevState => {
      return {
        ...prevState,
        items: this.state.items.splice(index, 1),
        canUpdate: true,
      };
    });
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

  //   componentWillUpdate(nextProps, nextState) {
  //     console.log('nextProps', nextProps);
  //     console.log('nextState', nextState);
  //   }

  //   componentWillReceiveProps(nextProps) {
  //     console.log('nextPropzzzz', nextProps);
  //   }

  render() {
    const { error, newType, aclTypes, typeChanged } = this.props;

    const { items, canUpdate } = this.state;

    const handleTypeChange = () => {
      typeChanged();
    };

    return (
      <div className="gf-form-group">
        asd
        <PermissionsList
          permissions={items}
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
                  <select className="gf-form-input gf-size-auto" onChange={handleTypeChange}>
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
                  <user-picker user-picked="ctrl.userPicked($user)" />
                </div>
              ) : null}

              {newType === 'Group' ? (
                <div className="gf-form">
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
          <button type="button" className="btn btn-danger" onClick={this.update} disabled={!canUpdate}>
            Update Permissions
          </button>
        </div>
        asd3
      </div>
    );
  }
}

export default Permissions;
