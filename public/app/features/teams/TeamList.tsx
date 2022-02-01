import React, { PureComponent } from 'react';
import Page from 'app/core/components/Page/Page';
import { DeleteButton, LinkButton, FilterInput, VerticalGroup, HorizontalGroup, Pagination } from '@grafana/ui';
import { NavModel } from '@grafana/data';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { AccessControlAction, Role, StoreState, Team } from 'app/types';
import { deleteTeam, loadTeams } from './state/actions';
import { getSearchQuery, getTeams, getTeamsCount, getTeamsSearchPage, isPermissionTeamAdmin } from './state/selectors';
import { getNavModel } from 'app/core/selectors/navModel';
import { config } from 'app/core/config';
import { contextSrv, User } from 'app/core/services/context_srv';
import { connectWithCleanUp } from '../../core/components/connectWithCleanUp';
import { setSearchQuery, setTeamsSearchPage } from './state/reducers';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';

const pageLimit = 30;

export interface Props {
  navModel: NavModel;
  teams: Team[];
  searchQuery: string;
  searchPage: number;
  teamsCount: number;
  hasFetched: boolean;
  loadTeams: typeof loadTeams;
  deleteTeam: typeof deleteTeam;
  setSearchQuery: typeof setSearchQuery;
  setTeamsSearchPage: typeof setTeamsSearchPage;
  editorsCanAdmin: boolean;
  signedInUser: User;
}

export interface State {
  roleOptions: Role[];
}

export class TeamList extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { roleOptions: [] };
  }

  componentDidMount() {
    this.fetchTeams();
    if (contextSrv.accessControlEnabled()) {
      this.fetchRoleOptions();
    }
  }

  async fetchTeams() {
    await this.props.loadTeams();
  }

  async fetchRoleOptions() {
    const roleOptions = await fetchRoleOptions();
    this.setState({ roleOptions });
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
            <img className="filter-table__avatar" src={team.avatarUrl} alt="Team avatar" />
          </a>
        </td>
        <td className="link-td">
          <a href={teamUrl}>{team.name}</a>
        </td>
        <td className="link-td">
          <a href={teamUrl} aria-label={team.email?.length > 0 ? undefined : 'Empty email cell'}>
            {team.email}
          </a>
        </td>
        <td className="link-td">
          <a href={teamUrl}>{team.memberCount}</a>
        </td>
        {contextSrv.accessControlEnabled() && (
          <td>
            <TeamRolePicker teamId={team.id} getRoleOptions={async () => this.state.roleOptions} />
          </td>
        )}
        <td className="text-right">
          <DeleteButton
            aria-label="Delete team"
            size="sm"
            disabled={!canDelete}
            onConfirm={() => this.deleteTeam(team)}
          />
        </td>
      </tr>
    );
  }

  renderEmptyList() {
    return (
      <EmptyListCTA
        title="You haven't created any teams yet."
        buttonIcon="users-alt"
        buttonLink="org/teams/new"
        buttonTitle=" New team"
        proTip="Assign folder and dashboard permissions to teams instead of users to ease administration."
        proTipLink=""
        proTipLinkTitle=""
        proTipTarget="_blank"
      />
    );
  }

  getPaginatedTeams = (teams: Team[]) => {
    const offset = (this.props.searchPage - 1) * pageLimit;
    return teams.slice(offset, offset + pageLimit);
  };

  renderTeamList() {
    const { teams, searchQuery, editorsCanAdmin, searchPage, setTeamsSearchPage } = this.props;
    const teamAdmin = contextSrv.hasRole('Admin') || (editorsCanAdmin && contextSrv.hasRole('Editor'));
    const canCreate = contextSrv.hasAccess(AccessControlAction.ActionTeamsCreate, teamAdmin);
    const newTeamHref = canCreate ? 'org/teams/new' : '#';
    const paginatedTeams = this.getPaginatedTeams(teams);
    const totalPages = Math.ceil(teams.length / pageLimit);

    return (
      <>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <FilterInput placeholder="Search teams" value={searchQuery} onChange={this.onSearchQueryChange} />
          </div>

          <LinkButton href={newTeamHref} disabled={!canCreate}>
            New Team
          </LinkButton>
        </div>

        <div className="admin-list-table">
          <VerticalGroup spacing="md">
            <table className="filter-table filter-table--hover form-inline">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Email</th>
                  <th>Members</th>
                  {contextSrv.accessControlEnabled() && <th>Roles</th>}
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>{paginatedTeams.map((team) => this.renderTeam(team))}</tbody>
            </table>
            <HorizontalGroup justify="flex-end">
              <Pagination
                onNavigate={setTeamsSearchPage}
                currentPage={searchPage}
                numberOfPages={totalPages}
                hideWhenSinglePage={true}
              />
            </HorizontalGroup>
          </VerticalGroup>
        </div>
      </>
    );
  }

  renderList() {
    const { teamsCount, hasFetched } = this.props;

    if (!hasFetched) {
      return null;
    }

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
        <Page.Contents isLoading={!hasFetched}>{this.renderList()}</Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'teams'),
    teams: getTeams(state.teams),
    searchQuery: getSearchQuery(state.teams),
    searchPage: getTeamsSearchPage(state.teams),
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
  setTeamsSearchPage,
};

export default connectWithCleanUp(mapStateToProps, mapDispatchToProps, (state) => state.teams)(TeamList);
