import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { aclTypes } from 'app/stores/PermissionsStore/PermissionsStore';
import UserPicker, { User } from 'app/core/components/Picker/UserPicker';
import TeamPicker, { Team } from 'app/core/components/Picker/TeamPicker';
import DescriptionPicker, { OptionWithDescription } from 'app/core/components/Picker/DescriptionPicker';
import { permissionOptions } from 'app/stores/PermissionsStore/PermissionsStore';

export interface IProps {
  permissions: any;
  backendSrv: any;
  dashboardId: any;
}
@observer
class AddPermissions extends Component<IProps, any> {
  constructor(props) {
    super(props);
    this.userPicked = this.userPicked.bind(this);
    this.teamPicked = this.teamPicked.bind(this);
    this.permissionPicked = this.permissionPicked.bind(this);
    this.typeChanged = this.typeChanged.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  componentWillMount() {
    const { permissions } = this.props;
    permissions.resetNewType();
  }

  typeChanged(evt) {
    const { value } = evt.target;
    const { permissions } = this.props;

    // if (value === 'Viewer' || value === 'Editor') {
    // //   permissions.addStoreItem({ permission: 1, role: value, dashboardId: dashboardId }, dashboardId);
    // //   this.resetNewType();
    //   return;
    // }

    permissions.setNewType(value);
  }

  userPicked(user: User) {
    const { permissions } = this.props;
    if (!user) {
      permissions.newItem.setUser(null, null);
      return;
    }
    permissions.newItem.setUser(user.id, user.login);
    // return permissions.addStoreItem({ userId: user.id, userLogin: user.login, permission: 1 });
  }

  teamPicked(team: Team) {
    const { permissions } = this.props;
    if (!team) {
      permissions.newItem.setTeam(null, null);
      return;
    }
    permissions.newItem.setTeam(team.id, team.name);
  }

  permissionPicked(permission: OptionWithDescription) {
    const { permissions } = this.props;
    permissions.newItem.setPermission(permission.value);
  }

  resetNewType() {
    const { permissions } = this.props;
    permissions.resetNewType();
  }

  handleSubmit(evt) {
    evt.preventDefault();
    const { permissions } = this.props;
    permissions.addStoreItem();
  }

  render() {
    const { permissions, backendSrv } = this.props;
    const newItem = permissions.newItem;

    return (
      <div className="gf-form-inline cta-form">
        <button className="cta-form__close btn btn-transparent" onClick={permissions.hideAddPermissions}>
          <i className="fa fa-close" />
        </button>
        <form name="addPermission" onSubmit={this.handleSubmit}>
          <h6>Add Permission For</h6>
          <div className="gf-form-inline">
            <div className="gf-form">
              <div className="gf-form-select-wrapper">
                <select className="gf-form-input gf-size-auto" value={newItem.type} onChange={this.typeChanged}>
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

            {newItem.type === 'User' ? (
              <div className="gf-form">
                <UserPicker backendSrv={backendSrv} handlePicked={this.userPicked} value={newItem.userId} />
              </div>
            ) : null}

            {newItem.type === 'Group' ? (
              <div className="gf-form">
                <TeamPicker backendSrv={backendSrv} handlePicked={this.teamPicked} value={newItem.teamId} />
              </div>
            ) : null}

            <div className="gf-form">
              <DescriptionPicker
                optionsWithDesc={permissionOptions}
                handlePicked={this.permissionPicked}
                value={newItem.permission}
                disabled={false}
                className={'gf-form-input--form-dropdown-right'}
              />
            </div>

            <div className="gf-form">
              <button data-save-permission className="btn btn-success" type="submit" disabled={!newItem.isValid()}>
                Save
              </button>
            </div>
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
    );
  }
}

export default AddPermissions;
