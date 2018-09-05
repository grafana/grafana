import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import DeleteButton from 'app/core/components/DeleteButton/DeleteButton';
import { NavModel, Team } from '../../types';
import { loadTeams } from './state/actions';
import { getTeams } from './state/selectors';
import { getNavModel } from 'app/core/selectors/navModel';

export interface Props {
  navModel: NavModel;
  teams: Team[];
  loadTeams: typeof loadTeams;
  search: string;
}

export class TeamList extends PureComponent<Props, any> {
  componentDidMount() {
    this.fetchTeams();
  }

  async fetchTeams() {
    await this.props.loadTeams();
  }

  deleteTeam = (team: Team) => {
    console.log('delete team', team);
  };

  onSearchQueryChange = event => {
    console.log('set search', event.target.value);
  };

  renderTeamMember(team: Team) {
    const teamUrl = `org/teams/edit/${team.id}`;

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
    const { navModel, teams, search } = this.props;

    return (
      <div>
        <PageHeader model={navModel as NavModel} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <div className="gf-form gf-form--grow">
              <label className="gf-form--has-input-icon gf-form--grow">
                <input
                  type="text"
                  className="gf-form-input"
                  placeholder="Search teams"
                  value={search}
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
              <tbody>{teams.map(team => this.renderTeamMember(team))}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'teams'),
    teams: getTeams(state.teams),
    search: '',
  };
}

const mapDispatchToProps = {
  loadTeams,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(TeamList));
