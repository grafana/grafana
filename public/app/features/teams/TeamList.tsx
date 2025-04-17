import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Avatar,
  CellProps,
  Column,
  DeleteButton,
  EmptyState,
  FilterInput,
  InlineField,
  InteractiveTable,
  LinkButton,
  Pagination,
  Stack,
  Tag,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { Trans, t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role, StoreState, TeamWithRoles } from 'app/types';

import { TeamRolePicker } from '../../core/components/RolePicker/TeamRolePicker';

import { deleteTeam, loadTeams, changePage, changeQuery, changeSort } from './state/actions';

type Cell<T extends keyof TeamWithRoles = keyof TeamWithRoles> = CellProps<TeamWithRoles, TeamWithRoles[T]>;
export interface OwnProps {}

export interface State {
  roleOptions: Role[];
}

// this is dummy data to pass to the table while the real data is loading
const skeletonData: TeamWithRoles[] = new Array(3).fill(null).map((_, index) => ({
  id: index,
  uid: '',
  memberCount: 0,
  name: '',
  orgId: 0,
  isProvisioned: false,
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

  const columns: Array<Column<TeamWithRoles>> = useMemo(
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
        cell: ({ cell: { value }, row: { original } }: Cell<'name'>) => {
          if (!hasFetched) {
            return <Skeleton width={100} />;
          }

          const canReadTeam = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRead, original);
          if (!canReadTeam) {
            return value;
          }

          return (
            <TextLink
              color="primary"
              inline={false}
              href={`/org/teams/edit/${original.uid}`}
              title={t('teams.team-list.columns.title-edit-team', 'Edit team')}
            >
              {value}
            </TextLink>
          );
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
        id: 'isProvisioned',
        header: '',
        cell: ({ cell: { value } }: Cell<'isProvisioned'>) => {
          if (!hasFetched) {
            return <Skeleton width={240} />;
          }
          return !!value && <Tag colorIndex={14} name={'Provisioned'} />;
        },
      },
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
          const canDelete =
            contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsDelete, original) &&
            !original.isProvisioned;
          return (
            <Stack direction="row" justifyContent="flex-end" gap={2}>
              {canReadTeam && (
                <LinkButton
                  href={`org/teams/edit/${original.uid}`}
                  aria-label={t('teams.team-list.columns.aria-label-edit-team', 'Edit team {{teamName}}', {
                    teamName: original.name,
                  })}
                  icon="pen"
                  size="sm"
                  variant="secondary"
                  tooltip={t('teams.team-list.columns.tooltip-edit-team', 'Edit team')}
                />
              )}
              <DeleteButton
                aria-label={t('teams.team-list.columns.aria-label-delete-button', 'Delete team {{teamName}}', {
                  teamName: original.name,
                })}
                size="sm"
                disabled={!canDelete}
                onConfirm={() => deleteTeam(original.uid)}
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
        !noTeams ? (
          <LinkButton href={canCreate ? 'org/teams/new' : '#'} disabled={!canCreate}>
            <Trans i18nKey="teams.team-list.new-team">New Team</Trans>
          </LinkButton>
        ) : undefined
      }
    >
      <Page.Contents>
        {noTeams ? (
          <EmptyState
            variant="call-to-action"
            button={
              <LinkButton disabled={!canCreate} href="org/teams/new" icon="users-alt" size="lg">
                <Trans i18nKey="teams.empty-state.button-title">New team</Trans>
              </LinkButton>
            }
            message={t('teams.empty-state.title', "You haven't created any teams yet")}
          >
            <Trans i18nKey="teams.empty-state.pro-tip">
              Assign folder and dashboard permissions to teams instead of users to ease administration.{' '}
              <TextLink external href="https://grafana.com/docs/grafana/latest/administration/team-management">
                Learn more
              </TextLink>
            </Trans>
          </EmptyState>
        ) : (
          <>
            <div className="page-action-bar">
              <InlineField grow>
                <FilterInput
                  placeholder={t('teams.team-list.placeholder-search-teams', 'Search teams')}
                  value={query}
                  onChange={changeQuery}
                />
              </InlineField>
            </div>
            {hasFetched && teams.length === 0 ? (
              <EmptyState variant="not-found" message={t('teams.empty-state.message', 'No teams found')} />
            ) : (
              <Stack direction={'column'} gap={2}>
                <InteractiveTable
                  columns={columns}
                  data={hasFetched ? teams : skeletonData}
                  getRowId={(team) => String(team.id)}
                  fetchData={changeSort}
                />
                <Stack justifyContent="flex-end">
                  <Pagination
                    hideWhenSinglePage
                    currentPage={page}
                    numberOfPages={totalPages}
                    onNavigate={changePage}
                  />
                </Stack>
              </Stack>
            )}
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
