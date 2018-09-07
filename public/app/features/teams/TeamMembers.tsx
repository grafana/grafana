import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { UserPicker, User } from 'app/core/components/Picker/UserPicker';
import DeleteButton from 'app/core/components/DeleteButton/DeleteButton';
import { Team, TeamMember } from '../../types';
import { loadTeamMembers, addTeamMember, removeTeamMember, setSearchMemberQuery } from './state/actions';
import { getSearchMemberQuery, getTeam } from './state/selectors';
import { getRouteParamsId } from '../../core/selectors/location';

interface Props {
  team: Team;
  searchMemberQuery: string;
  loadTeamMembers: typeof loadTeamMembers;
  addTeamMember: typeof addTeamMember;
  removeTeamMember: typeof removeTeamMember;
  setSearchMemberQuery: typeof setSearchMemberQuery;
}

interface State {
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

  onSearchQueryChange = event => {
    this.props.setSearchMemberQuery(event.target.value);
  };

  removeMember(member: TeamMember) {
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

  renderMember(member: TeamMember) {
    return (
      <tr key={member.userId}>
        <td className="width-4 text-center">
          <img className="filter-table__avatar" src={member.avatarUrl} />
        </td>
        <td>{member.login}</td>
        <td>{member.email}</td>
        <td className="text-right">
          <DeleteButton onConfirmDelete={() => this.removeMember(member)} />
        </td>
      </tr>
    );
  }

  render() {
    const { newTeamMember, isAdding } = this.state;
    const { team, searchMemberQuery } = this.props;
    const newTeamMemberValue = newTeamMember && newTeamMember.id.toString();

    return (
      <div>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <label className="gf-form--has-input-icon gf-form--grow">
              <input
                type="text"
                className="gf-form-input"
                placeholder="Search members"
                value={searchMemberQuery}
                onChange={this.onSearchQueryChange}
              />
              <i className="gf-form-input-icon fa fa-search" />
            </label>
          </div>

          <div className="page-action-bar__spacer" />

          <button className="btn btn-success pull-right" onClick={this.onToggleAdding} disabled={isAdding}>
            <i className="fa fa-plus" /> Add a member
          </button>
        </div>

        <SlideDown in={isAdding}>
          <div className="cta-form">
            <button className="cta-form__close btn btn-transparent" onClick={this.onToggleAdding}>
              <i className="fa fa-close" />
            </button>
            <h5>Add Team Member</h5>
            <div className="gf-form-inline">
              <UserPicker onSelected={this.onUserSelected} className="width-30" value={newTeamMemberValue} />

              {this.state.newTeamMember && (
                <button className="btn btn-success gf-form-btn" type="submit" onClick={this.onAddUserToTeam}>
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
                <th style={{ width: '1%' }} />
              </tr>
            </thead>
            <tbody>{team.members && team.members.map(member => this.renderMember(member))}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const teamId = getRouteParamsId(state.location);

  return {
    team: getTeam(state.team, teamId),
    searchMemberQuery: getSearchMemberQuery(state.team),
  };
}

const mapDispatchToProps = {
  loadTeamMembers,
  addTeamMember,
  removeTeamMember,
  setSearchMemberQuery,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(TeamMembers));
