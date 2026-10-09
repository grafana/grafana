import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Alert, type Column, Stack, Text } from '@grafana/ui';
import { useListTeamsRolesQuery } from 'app/api/clients/legacy';
import { useListUserRolesQuery } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { LoadError } from './LoadError';
import { TeamLink } from './TeamLink';
import { UserRolesEditor } from './UserManagement';
import { UserTable } from './UserTable';
import { type OverviewUser, type RoleAssignment, useGetOverviewTeamsQuery } from './api';

const collator = new Intl.Collator();

export function UserRoles({ user }: { user: OverviewUser }) {
  const licensed = contextSrv.licensedAccessControlEnabled();
  const canReadUserRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);
  const canReadTeamRoles = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList);
  const teams = useGetOverviewTeamsQuery(licensed && canReadTeamRoles ? user.uid : skipToken);
  const directRoles = useListUserRolesQuery(
    licensed && canReadUserRoles && user.id > 0
      ? { userId: user.id, targetOrgId: contextSrv.user.orgId, includeMapped: true }
      : skipToken
  );
  const teamIds = (teams.currentData ?? [])
    .map((team) => Number(team.metadata.labels?.['grafana.app/deprecatedInternalID']))
    .filter((id) => id > 0);
  const roles = useListTeamsRolesQuery(
    licensed && canReadTeamRoles && teamIds.length ? { rolesSearchQuery: { teamIds } } : skipToken
  );
  const assignments = useMemo<RoleAssignment[]>(
    () => [
      ...(user.role
        ? [
            {
              id: 'basic',
              role: user.role === 'None' ? t('admin.user-overview.no-basic-role', 'No basic role') : user.role,
              type: 'direct' as const,
            },
          ]
        : []),
      ...(directRoles.currentData ?? []).map(
        (role): RoleAssignment => ({
          id: `direct:${role.uid}`,
          role: role.displayName || role.name,
          description: role.description,
          type: 'direct',
        })
      ),
      ...(teams.currentData ?? []).flatMap((team) =>
        (roles.currentData?.[Number(team.metadata.labels?.['grafana.app/deprecatedInternalID'])] ?? []).map(
          (role): RoleAssignment => ({
            id: `${team.metadata.name}:${role.uid}`,
            role: role.displayName || role.name || '',
            description: role.description,
            type: 'team',
            team,
          })
        )
      ),
    ],
    [user.role, directRoles.currentData, teams.currentData, roles.currentData]
  );
  const columns = useMemo<Array<Column<RoleAssignment>>>(() => {
    const assignmentType = (assignment: RoleAssignment) =>
      assignment.id === 'basic'
        ? t('admin.user-overview.basic', 'Basic role')
        : assignment.type === 'team'
          ? t('admin.user-overview.inherited', 'Inherited from team')
          : t('admin.user-overview.direct', 'Directly assigned');
    const source = (assignment: RoleAssignment) =>
      assignment.team?.spec.title ??
      (assignment.id === 'basic' ? t('admin.user-overview.default', 'Default basic role') : user.login);
    return [
      {
        id: 'role',
        header: t('admin.user-overview.role', 'Role'),
        sortType: 'string',
        cell: ({ row: { original } }) => (
          <Stack direction="column" gap={0}>
            <Text>{original.role}</Text>
            {original.description && <Text color="secondary">{original.description}</Text>}
          </Stack>
        ),
      },
      {
        id: 'type',
        header: t('admin.user-overview.assignment', 'Assignment type'),
        cell: ({ row: { original } }) => assignmentType(original),
        sortType: (a, b) => collator.compare(assignmentType(a.original), assignmentType(b.original)),
      },
      {
        id: 'source',
        header: t('admin.user-overview.source', 'Source'),
        cell: ({ row: { original } }) => (original.team ? <TeamLink team={original.team} /> : source(original)),
        sortType: (a, b) => collator.compare(source(a.original), source(b.original)),
      },
    ];
  }, [user.login]);
  return (
    <Stack direction="column" gap={2}>
      {!!user.id && <UserRolesEditor user={user} basicRole={user.role} />}
      {licensed && (!canReadUserRoles || !canReadTeamRoles) && (
        <Alert
          severity="warning"
          title={t('admin.user-overview.forbidden', 'You do not have permission to view this information')}
        />
      )}
      {Boolean(teams.error || roles.error || directRoles.error) && (
        <LoadError error={teams.error || roles.error || directRoles.error} />
      )}
      {licensed && canReadUserRoles && !user.id && (
        <Alert severity="warning" title={t('admin.user-overview.not-found', 'This information is not available')} />
      )}
      {(teams.isFetching || roles.isFetching || directRoles.isFetching) && (
        <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>
      )}
      <UserTable columns={columns} data={assignments} getRowId={(assignment) => assignment.id} />
    </Stack>
  );
}
