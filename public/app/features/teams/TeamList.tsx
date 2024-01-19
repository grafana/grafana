import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Avatar,
  CellProps,
  Column,
  DeleteButton,
  FilterInput,
  Icon,
  InlineField,
  InteractiveTable,
  LinkButton,
  Pagination,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role, StoreState, Team } from 'app/types';

import { TeamRolePicker } from '../../core/components/RolePicker/TeamRolePicker';

import { deleteTeam, loadTeams, changePage, changeQuery, changeSort } from './state/actions';

type Cell<T extends keyof Team = keyof Team> = CellProps<Team, Team[T]>;
export interface OwnProps {}

export interface State {
  roleOptions: Role[];
}

// this is dummy data to pass to the table while the real data is loading
const skeletonData: Team[] = new Array(3).fill(null).map((_, index) => ({
  id: index,
  memberCount: 0,
  name: '',
  orgId: 0,
  permission: 0,
}));

export const TeamList = ({
  teams,
  query,
  noTeams,
  hasFetched,
  loadTeams,
  deleteTeam,
  changeQuery,
  totalPages,
  page,
  rolesLoading,
  changePage,
  changeSort,
}: Props) => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    loadTeams(true);
  }, [loadTeams]);

  useEffect(() => {
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      fetchRoleOptions().then((roles) => setRoleOptions(roles));
    }
  }, []);

  const canCreate = contextSrv.hasPermission(AccessControlAction.ActionTeamsCreate);
  const displayRolePicker = shouldDisplayRolePicker();

  const columns: Array<Column<Team>> = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        disableGrow: true,
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => {
          if (!hasFetched) {
            return <Skeleton containerClassName={styles.blockSkeleton} width={24} height={24} circle />;
          }

          return value && <Avatar src={value} alt="User avatar" />;
        },
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ cell: { value } }: Cell<'name'>) => {
          if (!hasFetched) {
            return <Skeleton width={100} />;
          }
          return value;
        },
        sortType: 'string',
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ cell: { value } }: Cell<'email'>) => {
          if (!hasFetched) {
            return <Skeleton width={60} />;
          }
          return value;
        },
        sortType: 'string',
      },
      {
        id: 'memberCount',
        header: 'Members',
        disableGrow: true,
        cell: ({ cell: { value } }: Cell<'memberCount'>) => {
          if (!hasFetched) {
            return <Skeleton width={40} />;
          }
          return value;
        },
        sortType: 'number',
      },
      ...(displayRolePicker
        ? [
            {
              id: 'role',
              header: 'Role',
              cell: ({ cell: { value }, row: { original } }: Cell<'memberCount'>) => {
                if (!hasFetched) {
                  return <Skeleton width={320} height={32} containerClassName={styles.blockSkeleton} />;
                }
                const canSeeTeamRoles = contextSrv.hasPermissionInMetadata(
                  AccessControlAction.ActionTeamsRolesList,
                  original
                );
                return (
                  canSeeTeamRoles && (
                    <TeamRolePicker
                      teamId={original.id}
                      roles={original.roles || []}
                      isLoading={rolesLoading}
                      roleOptions={roleOptions}
                      width={40}
                    />
                  )
                );
              },
            },
          ]
        : []),
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row: { original } }: Cell) => {
          if (!hasFetched) {
            return (
              <Stack direction="row" justifyContent="flex-end" alignItems="center">
                <Skeleton containerClassName={styles.blockSkeleton} width={16} height={16} />
                <Skeleton containerClassName={styles.blockSkeleton} width={22} height={24} />
              </Stack>
            );
          }

          const canReadTeam = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRead, original);
          const canDelete = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsDelete, original);
          return (
            <Stack direction="row" justifyContent="flex-end">
              {canReadTeam && (
                <Tooltip content={'Edit team'}>
                  <a href={`org/teams/edit/${original.id}`} aria-label={`Edit team ${original.name}`}>
                    <Icon name={'pen'} />
                  </a>
                </Tooltip>
              )}
              <DeleteButton
                aria-label={`Delete team ${original.name}`}
                size="sm"
                disabled={!canDelete}
                onConfirm={() => deleteTeam(original.id)}
              />
            </Stack>
          );
        },
      },
    ],
    [displayRolePicker, hasFetched, rolesLoading, roleOptions, deleteTeam, styles]
  );

  return (
    <Page
      navId="teams"
      actions={
        <LinkButton href={canCreate ? 'org/teams/new' : '#'} disabled={!canCreate}>
          New Team
        </LinkButton>
      }
    >
      <Page.Contents>
        {noTeams ? (
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
        ) : (
          <>
            <div className="page-action-bar">
              <InlineField grow>
                <FilterInput placeholder="Search teams" value={query} onChange={changeQuery} />
              </InlineField>
            </div>
            <Stack direction={'column'} gap={2}>
              <InteractiveTable
                columns={columns}
                data={hasFetched ? teams : skeletonData}
                getRowId={(team) => String(team.id)}
                fetchData={changeSort}
              />
              <Stack justifyContent="flex-end">
                <Pagination hideWhenSinglePage currentPage={page} numberOfPages={totalPages} onNavigate={changePage} />
              </Stack>
            </Stack>
          </>
        )}
      </Page.Contents>
    </Page>
  );
};

function shouldDisplayRolePicker(): boolean {
  return (
    contextSrv.licensedAccessControlEnabled() &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList)
  );
}

function mapStateToProps(state: StoreState) {
  return {
    teams: state.teams.teams,
    query: state.teams.query,
    perPage: state.teams.perPage,
    page: state.teams.page,
    noTeams: state.teams.noTeams,
    totalPages: state.teams.totalPages,
    hasFetched: state.teams.hasFetched,
    rolesLoading: state.teams.rolesLoading,
  };
}

const mapDispatchToProps = {
  loadTeams,
  deleteTeam,
  changePage,
  changeQuery,
  changeSort,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = OwnProps & ConnectedProps<typeof connector>;
export default connector(TeamList);

const getStyles = (theme: GrafanaTheme2) => ({
  blockSkeleton: css({
    lineHeight: 1,
    // needed for things to align properly in the table
    display: 'flex',
  }),
});
