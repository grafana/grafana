import React, { Component } from 'react';
import { UserPicker } from 'app/core/components/Picker/UserPicker';
import { TeamPicker, Team } from 'app/core/components/Picker/TeamPicker';
import DescriptionPicker, { OptionWithDescription } from 'app/core/components/Picker/DescriptionPicker';
import { User } from 'app/types';
import {
  dashboardPermissionLevels,
  dashboardAclTargets,
  AclTarget,
  PermissionLevel,
  NewDashboardAclItem,
  OrgRole,
} from 'app/types/acl';

export interface Props {
  onAddPermission: (item: NewDashboardAclItem) => void;
  onCancel: () => void;
}

class AddPermissions extends Component<Props, NewDashboardAclItem> {
  constructor(props) {
    super(props);
    this.state = this.getCleanState();
  }

  getCleanState() {
    return {
      userId: 0,
      teamId: 0,
      type: AclTarget.Team,
      permission: PermissionLevel.View,
    };
  }

  onTypeChanged = evt => {
    const type = evt.target.value as AclTarget;

    switch (type) {
      case AclTarget.User:
      case AclTarget.Team:
        this.setState({ type: type, userId: 0, teamId: 0, role: undefined });
        break;
      case AclTarget.Editor:
        this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Editor });
        break;
      case AclTarget.Viewer:
        this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Viewer });
        break;
    }
  };

  onUserSelected = (user: User) => {
    this.setState({ userId: user ? user.id : 0 });
  };

  onTeamSelected = (team: Team) => {
    this.setState({ teamId: team ? team.id : 0 });
  };

  onPermissionChanged = (permission: OptionWithDescription) => {
    this.setState({ permission: permission.value });
  };

  onSubmit = async evt => {
    evt.preventDefault();
    await this.props.onAddPermission(this.state);
    this.setState(this.getCleanState());
  };

  isValid() {
    switch (this.state.type) {
      case AclTarget.Team:
        return this.state.teamId > 0;
      case AclTarget.User:
        return this.state.userId > 0;
    }
    return true;
  }

  render() {
    const { onCancel } = this.props;
    const newItem = this.state;
    const pickerClassName = 'width-20';
    const isValid = this.isValid();

    return (
      <div className="gf-form-inline cta-form">
        <button className="cta-form__close btn btn-transparent" onClick={onCancel}>
          <i className="fa fa-close" />
        </button>
        <form name="addPermission" onSubmit={this.onSubmit}>
          <h5>Add Permission For</h5>
          <div className="gf-form-inline">
            <div className="gf-form">
              <div className="gf-form-select-wrapper">
                <select className="gf-form-input gf-size-auto" value={newItem.type} onChange={this.onTypeChanged}>
                  {dashboardAclTargets.map((option, idx) => {
                    return (
                      <option key={idx} value={option.value}>
                        {option.text}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {newItem.type === AclTarget.User ? (
              <div className="gf-form">
                <UserPicker
                  onSelected={this.onUserSelected}
                  value={newItem.userId.toString()}
                  className={pickerClassName}
                />
              </div>
            ) : null}

            {newItem.type === AclTarget.Team ? (
              <div className="gf-form">
                <TeamPicker
                  onSelected={this.onTeamSelected}
                  value={newItem.teamId.toString()}
                  className={pickerClassName}
                />
              </div>
            ) : null}

            <div className="gf-form">
              <DescriptionPicker
                optionsWithDesc={dashboardPermissionLevels}
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
