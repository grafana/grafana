import React from 'react';
import { hot } from 'react-hot-loader';
import { observer } from 'mobx-react';
import { ITeam, ITeamMember } from 'app/stores/TeamsStore/TeamsStore';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { UserPicker, User } from 'app/core/components/Picker/UserPicker';
import DeleteButton from 'app/core/components/DeleteButton/DeleteButton';

interface Props {
  team: ITeam;
}

interface State {
  isAdding: boolean;
  newTeamMember?: User;
}

@observer
export class TeamMembers extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = { isAdding: false, newTeamMember: null };
  }

  componentDidMount() {
    this.props.team.loadMembers();
  }

  onSearchQueryChange = evt => {
    this.props.team.setSearchQuery(evt.target.value);
  };

  removeMember(member: ITeamMember) {
    this.props.team.removeMember(member);
  }

  removeMemberConfirmed(member: ITeamMember) {
    this.props.team.removeMember(member);
  }

  renderMember(member: ITeamMember) {
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

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  onUserSelected = (user: User) => {
    this.setState({ newTeamMember: user });
  };

  onAddUserToTeam = async () => {
    await this.props.team.addMember(this.state.newTeamMember.id);
    await this.props.team.loadMembers();
    this.setState({ newTeamMember: null });
  };

  render() {
    const { newTeamMember, isAdding } = this.state;
    const members = this.props.team.members.values();
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
                value={''}
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
            <tbody>{members.map(member => this.renderMember(member))}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamMembers);
