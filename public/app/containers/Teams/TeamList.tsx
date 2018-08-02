import React from 'react';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavStore } from 'app/stores/NavStore/NavStore';
import { TeamsStore, ITeam } from 'app/stores/TeamsStore/TeamsStore';
import { BackendSrv } from 'app/core/services/backend_srv';
import DeleteButton from 'app/core/components/DeleteButton/DeleteButton';

interface Props {
  nav: typeof NavStore.Type;
  teams: typeof TeamsStore.Type;
  backendSrv: BackendSrv;
}

@inject('nav', 'teams')
@observer
export class TeamList extends React.Component<Props, any> {
  constructor(props) {
    super(props);

    this.props.nav.load('cfg', 'teams');
    this.fetchTeams();
  }

  fetchTeams() {
    this.props.teams.loadTeams();
  }

  deleteTeam(team: ITeam) {
    this.props.backendSrv.delete('/api/teams/' + team.id).then(this.fetchTeams.bind(this));
  }

  onSearchQueryChange = evt => {
    this.props.teams.setSearchQuery(evt.target.value);
  };

  renderTeamMember(team: ITeam): JSX.Element {
    let teamUrl = `org/teams/edit/${team.id}`;

    return (
      <tr key={team.id}>
        <td className="width-4 text-center link-td">
          <a href={teamUrl}>
            <img className="filter-table__avatar" src={team.avatarUrl} />
          </a>
        </td>
        <td className="link-td">
          <a href={teamUrl}>{team.name}</a>
        </td>
        <td className="link-td">
          <a href={teamUrl}>{team.email}</a>
        </td>
        <td className="link-td">
          <a href={teamUrl}>{team.memberCount}</a>
        </td>
        <td className="text-right">
          <DeleteButton onConfirmDelete={() => this.deleteTeam(team)} />
        </td>
      </tr>
    );
  }

  render() {
    const { nav, teams } = this.props;
    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <div className="gf-form gf-form--grow">
              <label className="gf-form--has-input-icon gf-form--grow">
                <input
                  type="text"
                  className="gf-form-input"
                  placeholder="Search teams"
                  value={teams.search}
                  onChange={this.onSearchQueryChange}
                />
                <i className="gf-form-input-icon fa fa-search" />
              </label>
            </div>

            <div className="page-action-bar__spacer" />

            <a className="btn btn-success" href="org/teams/new">
              <i className="fa fa-plus" /> New team
            </a>
          </div>

          <div className="admin-list-table">
            <table className="filter-table filter-table--hover form-inline">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Email</th>
                  <th>Members</th>
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>{teams.filteredTeams.map(team => this.renderTeamMember(team))}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamList);
