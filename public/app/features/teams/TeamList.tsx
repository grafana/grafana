import React, { PureComponent } from 'react';

import { DeleteButton, LinkButton, FilterInput, VerticalGroup, HorizontalGroup, Pagination } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { config } from 'app/core/config';
import { contextSrv, User } from 'app/core/services/context_srv';
import { AccessControlAction, Role, StoreState, Team } from 'app/types';

import { connectWithCleanUp } from '../../core/components/connectWithCleanUp';

import { deleteTeam, loadTeams } from './state/actions';
import { initialTeamsState, setSearchQuery, setTeamsSearchPage } from './state/reducers';
import { getSearchQuery, getTeams, getTeamsCount, getTeamsSearchPage, isPermissionTeamAdmin } from './state/selectors';

const pageLimit = 30;

export interface Props {
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
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
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
    const isTeamAdmin = isPermissionTeamAdmin({ permission, editorsCanAdmin, signedInUser });
    const canDelete = contextSrv.hasAccessInMetadata(AccessControlAction.ActionTeamsDelete, team, isTeamAdmin);
    const canReadTeam = contextSrv.hasAccessInMetadata(AccessControlAction.ActionTeamsRead, team, isTeamAdmin);
    const canSeeTeamRoles = contextSrv.hasAccessInMetadata(AccessControlAction.ActionTeamsRolesList, team, false);
    const displayRolePicker =
      contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList);

    return (
      <tr key={team.id}>
        <td className="width-4 text-center link-td">
          {canReadTeam ? (
            <a href={teamUrl}>
              <img className="filter-table__avatar" src={team.avatarUrl} alt="Team avatar" />
            </a>
          ) : (
            <img className="filter-table__avatar" src={team.avatarUrl} alt="Team avatar" />
          )}
        </td>
        <td className="link-td">
          {canReadTeam ? <a href={teamUrl}>{team.name}</a> : <div style={{ padding: '0px 8px' }}>{team.name}</div>}
        </td>
        <td className="link-td">
          {canReadTeam ? (
            <a href={teamUrl} aria-label={team.email?.length > 0 ? undefined : 'Empty email cell'}>
              {team.email}
            </a>
          ) : (
            <div style={{ padding: '0px 8px' }} aria-label={team.email?.length > 0 ? undefined : 'Empty email cell'}>
              {team.email}
            </div>
          )}
        </td>
        <td className="link-td">
          {canReadTeam ? (
            <a href={teamUrl}>{team.memberCount}</a>
          ) : (
            <div style={{ padding: '0px 8px' }}>{team.memberCount}</div>
          )}
        </td>
        {displayRolePicker && (
          <td>{canSeeTeamRoles && <TeamRolePicker teamId={team.id} roleOptions={this.state.roleOptions} />}</td>
        )}
        <td className="text-right">
          <DeleteButton
            aria-label={`Delete team ${team.name}`}
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
        buttonDisabled={!contextSrv.hasPermission(AccessControlAction.ActionTeamsCreate)}
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
    const displayRolePicker =
      contextSrv.licensedAccessControlEnabled() &&
      contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList) &&
      contextSrv.hasPermission(AccessControlAction.ActionRolesList);
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
                  {displayRolePicker && <th>Roles</th>}
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
    const { hasFetched } = this.props;

    return (
      <Page navId="teams">
        <Page.Contents isLoading={!hasFetched}>{this.renderList()}</Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
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

export default connectWithCleanUp(
  mapStateToProps,
  mapDispatchToProps,
  (state) => (state.teams = initialTeamsState)
)(TeamList);
