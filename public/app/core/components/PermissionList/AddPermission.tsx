import React, { Component } from 'react';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TeamPicker, Team } from 'app/core/components/Select/TeamPicker';
import { LegacyForms, Icon } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { User } from 'app/types';
import {
  dashboardPermissionLevels,
  dashboardAclTargets,
  AclTarget,
  PermissionLevel,
  NewDashboardAclItem,
  OrgRole,
} from 'app/types/acl';
const { Select } = LegacyForms;

export interface Props {
  onAddPermission: (item: NewDashboardAclItem) => void;
  onCancel: () => void;
}

class AddPermissions extends Component<Props, NewDashboardAclItem> {
  static defaultProps = {
    showPermissionLevels: true,
  };

  constructor(props: Props) {
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

  onTypeChanged = (evt: any) => {
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
    this.setState({ userId: user && !Array.isArray(user) ? user.id : 0 });
  };

  onTeamSelected = (team: Team) => {
    this.setState({ teamId: team && !Array.isArray(team) ? team.id : 0 });
  };

  onPermissionChanged = (permission: SelectableValue<PermissionLevel>) => {
    this.setState({ permission: permission.value! });
  };

  onSubmit = async (evt: React.SyntheticEvent) => {
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
    const pickerClassName = 'min-width-20';
    const isValid = this.isValid();
    return (
      <div className="gf-form-inline cta-form">
        <button className="cta-form__close btn btn-transparent" onClick={onCancel}>
          <Icon name="times" />
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
                <UserPicker onSelected={this.onUserSelected} className={pickerClassName} />
              </div>
            ) : null}

            {newItem.type === AclTarget.Team ? (
              <div className="gf-form">
                <TeamPicker onSelected={this.onTeamSelected} className={pickerClassName} />
              </div>
            ) : null}

            <div className="gf-form">
              <Select
                isSearchable={false}
                options={dashboardPermissionLevels}
                onChange={this.onPermissionChanged}
                className="gf-form-select-box__control--menu-right"
              />
            </div>

            <div className="gf-form">
              <button data-save-permission className="btn btn-primary" type="submit" disabled={!isValid}>
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
