import React, { useEffect, useState } from 'react';

import { LinkButton, FilterInput, VerticalGroup, HorizontalGroup, Pagination } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { config } from 'app/core/config';
import { contextSrv, User } from 'app/core/services/context_srv';
import { AccessControlAction, Role, StoreState, Team } from 'app/types';

import { connectWithCleanUp } from '../../core/components/connectWithCleanUp';

import { TeamListRow } from './TeamListRow';
import { deleteTeam, loadTeams } from './state/actions';
import { initialTeamsState, setSearchQuery, setCurrentPage } from './state/reducers';
import { getTeams, isPermissionTeamAdmin } from './state/selectors';

const pageLimit = 30;

export interface Props {
  teams: Team[];
  totalCount: number;
  currentPage: number;
  searchQuery: string;
  hasFetched: boolean;
  loadTeams: typeof loadTeams;
  deleteTeam: typeof deleteTeam;
  setCurrentPage: typeof setCurrentPage;
  setSearchQuery: typeof setSearchQuery;
  editorsCanAdmin: boolean;
  signedInUser: User;
}

export interface State {
  roleOptions: Role[];
}

const TeamList = ({ hasFetched, loadTeams, ...rest }: Props) => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);

  useEffect(() => {
    loadTeams();
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      fetchRoleOptions().then((roles) => setRoleOptions(roles));
    }
  }, [loadTeams]);

  const render = () => {
    const { teams, totalCount, currentPage } = rest;

    if (!hasFetched) {
      return null;
    }

    if (totalCount === 0) {
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

    const { searchQuery, editorsCanAdmin, setCurrentPage, signedInUser } = rest;
    const canCreate = canCreateTeam(editorsCanAdmin);
    const displayRolePicker = shouldDisaplyRolePicker();

    return (
      <>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <FilterInput placeholder="Search teams" value={searchQuery} onChange={rest.setSearchQuery} />
          </div>

          <LinkButton href={canCreate ? 'org/teams/new' : '#'} disabled={!canCreate}>
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
              <tbody>
                {teams.map((team) => (
                  <TeamListRow
                    key={team.id}
                    team={team}
                    roleOptions={roleOptions}
                    displayRolePicker={displayRolePicker}
                    isTeamAdmin={isPermissionTeamAdmin({ permission: team.permission, editorsCanAdmin, signedInUser })}
                    onDelete={rest.deleteTeam}
                  />
                ))}
              </tbody>
            </table>
            <HorizontalGroup justify="flex-end">
              <Pagination
                onNavigate={setCurrentPage}
                currentPage={currentPage}
                numberOfPages={Math.ceil(totalCount / pageLimit)}
                hideWhenSinglePage={true}
              />
            </HorizontalGroup>
          </VerticalGroup>
        </div>
      </>
    );
  };

  return (
    <Page navId="teams">
      <Page.Contents isLoading={!hasFetched}>{render()}</Page.Contents>
    </Page>
  );
};

function canCreateTeam(editorsCanAdmin: boolean): boolean {
  const teamAdmin = contextSrv.hasRole('Admin') || (editorsCanAdmin && contextSrv.hasRole('Editor'));
  return contextSrv.hasAccess(AccessControlAction.ActionTeamsCreate, teamAdmin);
}

function shouldDisaplyRolePicker(): boolean {
  return (
    contextSrv.licensedAccessControlEnabled() &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList)
  );
}

function mapStateToProps(state: StoreState) {
  return {
    teams: getTeams(state.teams),
    totalCount: state.teams.totalCount,
    currentPage: state.teams.currentPage,
    searchQuery: state.teams.searchQuery,
    hasFetched: state.teams.hasFetched,
    editorsCanAdmin: config.editorsCanAdmin, // this makes the feature toggle mockable/controllable from tests,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  loadTeams,
  deleteTeam,
  setCurrentPage,
  setSearchQuery,
};

export default connectWithCleanUp(
  mapStateToProps,
  mapDispatchToProps,
  (state) => (state.teams = initialTeamsState)
)(TeamList);
