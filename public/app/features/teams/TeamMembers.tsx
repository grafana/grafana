import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { DeleteButton, Select, SelectOptionItem } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { TeamMember, User, teamsPermissionLevels } from 'app/types';
import {
  loadTeamMembers,
  addTeamMember,
  removeTeamMember,
  setSearchMemberQuery,
  updateTeamMember,
} from './state/actions';
import { getSearchMemberQuery, getTeamMembers } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { WithFeatureToggle } from 'app/core/components/WithFeatureToggle';
import { config } from 'app/core/config';

export interface Props {
  members: TeamMember[];
  searchMemberQuery: string;
  loadTeamMembers: typeof loadTeamMembers;
  addTeamMember: typeof addTeamMember;
  removeTeamMember: typeof removeTeamMember;
  setSearchMemberQuery: typeof setSearchMemberQuery;
  updateTeamMember: typeof updateTeamMember;
  syncEnabled: boolean;
}

export interface State {
  isAdding: boolean;
  newTeamMember?: User;
}

export class TeamMembers extends PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = { isAdding: false, newTeamMember: null };
  }

  componentDidMount() {
    this.props.loadTeamMembers();
  }

  onSearchQueryChange = (value: string) => {
    this.props.setSearchMemberQuery(value);
  };

  onRemoveMember(member: TeamMember) {
    this.props.removeTeamMember(member.userId);
  }

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  onUserSelected = (user: User) => {
    this.setState({ newTeamMember: user });
  };

  onAddUserToTeam = async () => {
    this.props.addTeamMember(this.state.newTeamMember.id);
    this.setState({ newTeamMember: null });
  };

  renderLabels(labels: string[]) {
    if (!labels) {
      return <td />;
    }

    return (
      <td>
        {labels.map(label => (
          <TagBadge key={label} label={label} removeIcon={false} count={0} onClick={() => {}} />
        ))}
      </td>
    );
  }

  onPermissionChange = (item: SelectOptionItem, member: TeamMember) => {
    const permission = item.value;
    const updatedTeamMember = { ...member, permission };

    this.props.updateTeamMember(updatedTeamMember);
  };

  renderMember(member: TeamMember, syncEnabled: boolean) {
    return (
      <tr key={member.userId}>
        <td className="width-4 text-center">
          <img className="filter-table__avatar" src={member.avatarUrl} />
        </td>
        <td>{member.login}</td>
        <td>{member.email}</td>
        <WithFeatureToggle featureToggle={config.editorsCanOwn}>
          <td>
            <div className="gf-form">
              <Select
                isSearchable={false}
                options={teamsPermissionLevels}
                onChange={item => this.onPermissionChange(item, member)}
                className="gf-form-select-box__control--menu-right"
                value={teamsPermissionLevels.find(dp => dp.value === member.permission)}
              />
            </div>
          </td>
        </WithFeatureToggle>
        {syncEnabled && this.renderLabels(member.labels)}
        <td className="text-right">
          <DeleteButton onConfirm={() => this.onRemoveMember(member)} />
        </td>
      </tr>
    );
  }

  render() {
    const { isAdding } = this.state;
    const { searchMemberQuery, members, syncEnabled } = this.props;
    return (
      <div>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <FilterInput
              labelClassName="gf-form--has-input-icon gf-form--grow"
              inputClassName="gf-form-input"
              placeholder="Search members"
              value={searchMemberQuery}
              onChange={this.onSearchQueryChange}
            />
          </div>

          <div className="page-action-bar__spacer" />

          <button className="btn btn-primary pull-right" onClick={this.onToggleAdding} disabled={isAdding}>
            Add member
          </button>
        </div>

        <SlideDown in={isAdding}>
          <div className="cta-form">
            <button className="cta-form__close btn btn-transparent" onClick={this.onToggleAdding}>
              <i className="fa fa-close" />
            </button>
            <h5>Add team member</h5>
            <div className="gf-form-inline">
              <UserPicker onSelected={this.onUserSelected} className="min-width-30" />
              {this.state.newTeamMember && (
                <button className="btn btn-primary gf-form-btn" type="submit" onClick={this.onAddUserToTeam}>
                  Add to team
                </button>
              )}
            </div>
          </div>
        </SlideDown>

        <div className="admin-list-table">
          <table className="filter-table filter-table--hover form-inline">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Email</th>
                <WithFeatureToggle featureToggle={config.editorsCanOwn}>
                  <th>Permission</th>
                </WithFeatureToggle>
                {syncEnabled && <th />}
                <th style={{ width: '1%' }} />
              </tr>
            </thead>
            <tbody>{members && members.map(member => this.renderMember(member, syncEnabled))}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    members: getTeamMembers(state.team),
    searchMemberQuery: getSearchMemberQuery(state.team),
  };
}

const mapDispatchToProps = {
  loadTeamMembers,
  addTeamMember,
  removeTeamMember,
  setSearchMemberQuery,
  updateTeamMember,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TeamMembers);
