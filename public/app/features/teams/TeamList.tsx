import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import Page from 'app/core/components/Page/Page';
import { DeleteButton } from '@grafana/ui';
import { NavModel } from '@grafana/data';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Team, OrgRole, StoreState } from 'app/types';
import { loadTeams, deleteTeam, setSearchQuery } from './state/actions';
import { getSearchQuery, getTeams, getTeamsCount, isPermissionTeamAdmin } from './state/selectors';
import { getNavModel } from 'app/core/selectors/navModel';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { config } from 'app/core/config';
import { contextSrv, User } from 'app/core/services/context_srv';
import { connectWithCleanUp } from '../../core/components/connectWithCleanUp';

export interface Props {
  navModel: NavModel;
  teams: Team[];
  searchQuery: string;
  teamsCount: number;
  hasFetched: boolean;
  loadTeams: typeof loadTeams;
  deleteTeam: typeof deleteTeam;
  setSearchQuery: typeof setSearchQuery;
  editorsCanAdmin?: boolean;
  signedInUser?: User;
}

export class TeamList extends PureComponent<Props, any> {
  componentDidMount() {
    this.fetchTeams();
  }

  async fetchTeams() {
    await this.props.loadTeams();
  }

  deleteTeam = (team: Team) => {
    this.props.deleteTeam(team.id);
  };

  onSearchQueryChange = (value: string) => {
    this.props.setSearchQuery(value);
  };

  renderTeam(team: Team) {
    const { editorsCanAdmin, signedInUser } = this.props;
    const permission = team.permission;
    const teamUrl = `org/teams/edit/${team.id}`;
    const canDelete = isPermissionTeamAdmin({ permission, editorsCanAdmin, signedInUser });

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
          <DeleteButton onConfirm={() => this.deleteTeam(team)} disabled={!canDelete} />
        </td>
      </tr>
    );
  }

  renderEmptyList() {
    return (
      <EmptyListCTA
        title="You haven't created any teams yet."
        buttonIcon="gicon gicon-team"
        buttonLink="org/teams/new"
        buttonTitle=" New team"
        proTip="Assign folder and dashboard permissions to teams instead of users to ease administration."
        proTipLink=""
        proTipLinkTitle=""
        proTipTarget="_blank"
      />
    );
  }

  renderTeamList() {
    const { teams, searchQuery, editorsCanAdmin, signedInUser } = this.props;
    const isCanAdminAndViewer = editorsCanAdmin && signedInUser.orgRole === OrgRole.Viewer;
    const disabledClass = isCanAdminAndViewer ? ' disabled' : '';
    const newTeamHref = isCanAdminAndViewer ? '#' : 'org/teams/new';

    return (
      <>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <FilterInput
              labelClassName="gf-form--has-input-icon gf-form--grow"
              inputClassName="gf-form-input"
              placeholder="Search teams"
              value={searchQuery}
              onChange={this.onSearchQueryChange}
            />
          </div>

          <div className="page-action-bar__spacer" />

          <a className={`btn btn-primary${disabledClass}`} href={newTeamHref}>
            New team
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
            <tbody>{teams.map(team => this.renderTeam(team))}</tbody>
          </table>
        </div>
      </>
    );
  }

  renderList() {
    const { teamsCount } = this.props;

    if (teamsCount > 0) {
      return this.renderTeamList();
    } else {
      return this.renderEmptyList();
    }
  }

  render() {
    const { hasFetched, navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!hasFetched}>{hasFetched && this.renderList()}</Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'teams'),
    teams: getTeams(state.teams),
    searchQuery: getSearchQuery(state.teams),
    teamsCount: getTeamsCount(state.teams),
    hasFetched: state.teams.hasFetched,
    editorsCanAdmin: config.editorsCanAdmin, // this makes the feature toggle mockable/controllable from tests,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  loadTeams,
  deleteTeam,
  setSearchQuery,
};

export default hot(module)(connectWithCleanUp(mapStateToProps, mapDispatchToProps, state => state.teams)(TeamList));
