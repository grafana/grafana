import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { SortingRule } from 'react-table';

import { Trans, t } from '@grafana/i18n';
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
  LoadingPlaceholder,
  Pagination,
  Stack,
  Tag,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';

import { TeamRolePicker } from '../../core/components/RolePicker/TeamRolePicker';
import { EnterpriseAuthFeaturesCard } from '../admin/EnterpriseAuthFeaturesCard';

import { useDeleteTeam, useGetTeams } from './hooks';

type Cell<T extends keyof TeamWithRoles = keyof TeamWithRoles> = CellProps<TeamWithRoles, TeamWithRoles[T]>;

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

const TeamList = () => {
  const canCreate = contextSrv.hasPermission(AccessControlAction.ActionTeamsCreate);
  const displayRolePicker = shouldDisplayRolePicker();
  const pageSize = 20;

  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const styles = useStyles2(getStyles);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string>();
  const { data, isLoading } = useGetTeams({ query, pageSize, page, sort });
  const [deleteTeam] = useDeleteTeam();

  const teams = data?.teams || [];
  const totalPages = Math.ceil((data?.totalCount || 0) / pageSize) || 0;
  const noTeams = teams?.length === 0;
  const changeSort = useCallback(
    (sort: SortingRule<unknown>) => {
      setSort(`${sort.id}-${sort.desc ? 'desc' : 'asc'}`);
    },
    [setSort]
  );
  const changePage = (page: number) => {
    setPage(page);
  };

  useEffect(() => {
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      fetchRoleOptions().then((roles) => setRoleOptions(roles));
    }
  }, []);

  const columns: Array<Column<TeamWithRoles>> = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        disableGrow: true,
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => {
          if (isLoading) {
            return <Skeleton containerClassName={styles.blockSkeleton} width={24} height={24} circle />;
          }

          return value && <Avatar src={value} alt="User avatar" />;
        },
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ cell: { value }, row: { original } }: Cell<'name'>) => {
          if (isLoading) {
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
          if (isLoading) {
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
          if (isLoading) {
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
              cell: ({ row: { original } }: Cell<'memberCount'>) => {
                if (isLoading) {
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
                      isLoading={isLoading}
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
          if (isLoading) {
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
          if (isLoading) {
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
                onConfirm={() => deleteTeam({ uid: original.uid })}
              />
            </Stack>
          );
        },
      },
    ],
    [displayRolePicker, isLoading, styles.blockSkeleton, roleOptions, deleteTeam]
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
        {!isLoading && !query && teams.length === 0 ? (
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
                  onChange={setQuery}
                />
              </InlineField>
            </div>
            {!isLoading && teams.length === 0 && (
              <EmptyState variant="not-found" message={t('teams.empty-state.message', 'No teams found')} />
            )}
            {isLoading && <LoadingPlaceholder text={t('teams.team-list.loading-teams', 'Loading teams...')} />}
            {!isLoading && teams.length > 0 && (
              <Stack direction={'column'} gap={2}>
                <InteractiveTable
                  columns={columns}
                  data={isLoading ? skeletonData : teams}
                  getRowId={(team) => String(team.id)}
                  fetchData={({ sortBy }) => {
                    const sortingRule = sortBy.at(0);
                    if (sortingRule) {
                      return changeSort(sortingRule);
                    }
                  }}
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
        {!query && <EnterpriseAuthFeaturesCard page="teams" />}
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

export default TeamList;

const getStyles = () => ({
  blockSkeleton: css({
    lineHeight: 1,
    // needed for things to align properly in the table
    display: 'flex',
  }),
});
