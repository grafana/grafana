import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { aclTypes } from 'app/stores/PermissionsStore/PermissionsStore';
import { UserPicker, User } from 'app/core/components/Picker/UserPicker';
import { TeamPicker, Team } from 'app/core/components/Picker/TeamPicker';
import DescriptionPicker, { OptionWithDescription } from 'app/core/components/Picker/DescriptionPicker';
import { permissionOptions } from 'app/stores/PermissionsStore/PermissionsStore';

export interface Props {
  permissions: any;
}

@observer
class AddPermissions extends Component<Props, any> {
  constructor(props) {
    super(props);
  }

  componentWillMount() {
    const { permissions } = this.props;
    permissions.resetNewType();
  }

  onTypeChanged = evt => {
    const { value } = evt.target;
    const { permissions } = this.props;

    permissions.setNewType(value);
  };

  onUserSelected = (user: User) => {
    const { permissions } = this.props;
    if (!user) {
      permissions.newItem.setUser(null, null);
      return;
    }
    return permissions.newItem.setUser(user.id, user.login, user.avatarUrl);
  };

  onTeamSelected = (team: Team) => {
    const { permissions } = this.props;
    if (!team) {
      permissions.newItem.setTeam(null, null);
      return;
    }
    return permissions.newItem.setTeam(team.id, team.name, team.avatarUrl);
  };

  onPermissionChanged = (permission: OptionWithDescription) => {
    const { permissions } = this.props;
    return permissions.newItem.setPermission(permission.value);
  };

  resetNewType() {
    const { permissions } = this.props;
    return permissions.resetNewType();
  }

  onSubmit = evt => {
    evt.preventDefault();
    const { permissions } = this.props;
    permissions.addStoreItem();
  };

  render() {
    const { permissions } = this.props;
    const newItem = permissions.newItem;
    const pickerClassName = 'width-20';

    const isValid = newItem.isValid();

    return (
      <div className="gf-form-inline cta-form">
        <button className="cta-form__close btn btn-transparent" onClick={permissions.hideAddPermissions}>
          <i className="fa fa-close" />
        </button>
        <form name="addPermission" onSubmit={this.onSubmit}>
          <h5>Add Permission For</h5>
          <div className="gf-form-inline">
            <div className="gf-form">
              <div className="gf-form-select-wrapper">
                <select className="gf-form-input gf-size-auto" value={newItem.type} onChange={this.onTypeChanged}>
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
                <UserPicker onSelected={this.onUserSelected} value={newItem.userId} className={pickerClassName} />
              </div>
            ) : null}

            {newItem.type === 'Group' ? (
              <div className="gf-form">
                <TeamPicker onSelected={this.onTeamSelected} value={newItem.teamId} className={pickerClassName} />
              </div>
            ) : null}

            <div className="gf-form">
              <DescriptionPicker
                optionsWithDesc={permissionOptions}
                onSelected={this.onPermissionChanged}
                value={newItem.permission}
                disabled={false}
                className={'gf-form-input--form-dropdown-right'}
              />
            </div>

            <div className="gf-form">
              <button data-save-permission className="btn btn-success" type="submit" disabled={!isValid}>
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }
}

export default AddPermissions;
