import React from 'react';
import { hot } from 'react-hot-loader';
import { observer } from 'mobx-react';
import { ITeam, ITeamMember } from 'app/stores/TeamsStore/TeamsStore';
import appEvents from 'app/core/app_events';

interface Props {
  team: ITeam;
}

@observer
export class TeamMembers extends React.Component<Props, any> {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.props.team.loadMembers();
  }

  onSearchQueryChange = evt => {
    //this.props.teams.setSearchQuery(evt.target.value);
  };

  removeMember(member: ITeamMember) {
    appEvents.emit('confirm-modal', {
      title: 'Remove Member',
      text: 'Are you sure you want to remove ' + member.login + ' from this group?',
      yesText: 'Remove',
      icon: 'fa-warning',
      onConfirm: () => {
        this.removeMemberConfirmed(member);
      },
    });
  }

  removeMemberConfirmed(member: ITeamMember) {
    this.props.team.removeMember(member);
  }

  renderMember(member: ITeamMember) {
    return (
      <tr>
        <td className="width-4 text-center">
          <img className="filter-table__avatar" src={member.avatarUrl} />
        </td>
        <td>{member.login}</td>
        <td>{member.email}</td>
        <td style={{ width: '1%' }}>
          <a onClick={() => this.removeMember(member)} className="btn btn-danger btn-mini">
            <i className="fa fa-remove" />
          </a>
        </td>
      </tr>
    );
  }

  render() {
    const members = this.props.team.members.values();

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

          <a className="btn btn-success" href="org/teams/new">
            <i className="fa fa-plus" /> Add a member
          </a>
        </div>

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
