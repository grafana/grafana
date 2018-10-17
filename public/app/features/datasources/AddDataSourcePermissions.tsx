import React, { PureComponent } from 'react';
import { UserPicker } from 'app/core/components/Picker/UserPicker';
import { Team, TeamPicker } from 'app/core/components/Picker/TeamPicker';
import DescriptionPicker, { OptionWithDescription } from 'app/core/components/Picker/DescriptionPicker';
import { dataSourceAclLevels, AclTarget, DataSourcePermissionLevel } from 'app/types/acl';
import { User } from 'app/types';

export interface Props {
  onAddPermission: (state) => void;
  onCancel: () => void;
}

interface State {
  userId: number;
  teamId: number;
  type: AclTarget;
  permission: DataSourcePermissionLevel;
}

export class AddDataSourcePermissions extends PureComponent<Props, State> {
  cleanState = () => ({
    userId: 0,
    teamId: 0,
    type: AclTarget.Team,
    permission: DataSourcePermissionLevel.Query,
  });

  state = this.cleanState();

  isValid() {
    switch (this.state.type) {
      case AclTarget.Team:
        return this.state.teamId > 0;
      case AclTarget.User:
        return this.state.userId > 0;
    }
    return true;
  }

  onTeamSelected = (team: Team) => {
    this.setState({ teamId: team ? team.id : 0 });
  };

  onUserSelected = (user: User) => {
    this.setState({ userId: user ? user.id : 0 });
  };

  onPermissionChanged = (permission: OptionWithDescription) => {
    this.setState({ permission: permission.value });
  };

  onTypeChanged = event => {
    const type = event.target.value as AclTarget;

    this.setState({ type: type, userId: 0, teamId: 0 });
  };

  onSubmit = async event => {
    event.preventDefault();

    await this.props.onAddPermission(this.state);
    this.setState(this.cleanState());
  };

  render() {
    const { onCancel } = this.props;
    const { type } = this.state;

    const pickerClassName = 'width-20';
    const aclTargets = [{ value: AclTarget.Team, text: 'Team' }, { value: AclTarget.User, text: 'User' }];

    return (
      <div className="gf-form-inline cta-form">
        <button className="cta-form__close btn btn-transparent" onClick={onCancel}>
          <i className="fa fa-close" />
        </button>
        <form name="addPermission" onSubmit={this.onSubmit}>
          <h5>Add Permission For</h5>
          <div className="gf-form-inline">
            <div className="gf-form">
              <select className="gf-form-input gf-size-auto" value={type} onChange={this.onTypeChanged}>
                {aclTargets.map((option, idx) => {
                  return (
                    <option key={idx} value={option.value}>
                      {option.text}
                    </option>
                  );
                })}
              </select>
            </div>
            {type === AclTarget.User && (
              <div className="gf-form">
                <UserPicker onSelected={this.onUserSelected} className={pickerClassName} />
              </div>
            )}

            {type === AclTarget.Team && (
              <div className="gf-form">
                <TeamPicker onSelected={this.onTeamSelected} className={pickerClassName} />
              </div>
            )}
            <div className="gf-form">
              <DescriptionPicker
                optionsWithDesc={dataSourceAclLevels}
                onSelected={this.onPermissionChanged}
                disabled={false}
                className={'gf-form-input--form-dropdown-right'}
              />
            </div>
            <div className="gf-form">
              <button data-save-permission className="btn btn-success" type="submit" disabled={!this.isValid()}>
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }
}

export default AddDataSourcePermissions;
