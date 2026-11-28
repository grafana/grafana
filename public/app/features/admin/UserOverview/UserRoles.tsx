import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, type Column, InteractiveTable, Stack, Text } from '@grafana/ui';
import { type RoleDto, useListTeamsRolesQuery } from 'app/api/clients/legacy';
import { useListUserRolesQuery } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { addDisplayNameForFixedRole, addFilteredDisplayName } from 'app/core/utils/roles';
import { AccessControlAction } from 'app/types/accessControl';

import { LoadError, LoadState } from './LoadState';
import { TeamLink } from './TeamLink';
import { UserRolesEditor } from './UserRolesEditor';
import { type UserTeam, useUserOverview, useUserTeams } from './hooks';

interface RoleRow {
  id: string;
  role: string;
  description?: string;
  type: string;
  source: string;
  team?: UserTeam;
}

// Display names repeat across groups ("Reader"), so the label carries the group, as in the role picker.
function roleLabel(dto: RoleDto) {
  const role = addDisplayNameForFixedRole(addFilteredDisplayName(dto));
  return role.filteredDisplayName || role.displayName || role.name;
}

export function UserRoles({ uid }: { uid: string }) {
  const { user, member, members, isNotMember, isMembershipUnknown } = useUserOverview(uid);
  const licensed = contextSrv.licensedAccessControlEnabled();
  const canReadUserRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);
  const canReadTeamRoles = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList);
  // A user outside the organization has no roles in it, so the role requests wait for the membership lookup.
  // A failed lookup does not stop them: the roles are read under their own permissions.
  const loadRoles = !!user && !members.isLoading && !isNotMember;

  const directRoles = useListUserRolesQuery(
    licensed && canReadUserRoles && user && loadRoles
      ? // The role picker reads with the same arguments, so both share one request.
        { userId: user.id, includeHidden: true, includeMapped: true, targetOrgId: contextSrv.user.orgId }
      : skipToken
  );
  const teams = useUserTeams(user?.uid, { skip: !licensed || !canReadTeamRoles || !loadRoles });
  const teamIds = (teams.teams ?? []).map((team) => team.id).filter((id): id is number => !!id);
  const teamRoles = useListTeamsRolesQuery(teamIds.length ? { rolesSearchQuery: { teamIds } } : skipToken);

  const rows = useMemo<RoleRow[]>(() => {
    const basic: RoleRow[] = member
      ? [
          {
            id: 'basic',
            role: member.role === OrgRole.None ? t('admin.user-overview.no-basic-role', 'No basic role') : member.role,
            type: t('admin.user-overview.basic', 'Basic role'),
            source: t('admin.user-overview.default', 'Default basic role'),
          },
        ]
      : [];
    const direct = (directRoles.currentData ?? [])
      .filter((role) => !role.hidden)
      .map((role) => ({
        id: `direct:${role.uid}`,
        role: roleLabel(role),
        description: role.description,
        type: t('admin.user-overview.direct', 'Directly assigned'),
        source: '—',
      }));
    const inherited = (teams.teams ?? []).flatMap((team) =>
      ((team.id && teamRoles.currentData?.[team.id]) || []).map((role) => ({
        id: `${team.uid}:${role.uid}`,
        role: roleLabel(role),
        description: role.description,
        type: t('admin.user-overview.inherited', 'Inherited from team'),
        source: team.name,
        team,
      }))
    );
    return [...basic, ...direct, ...inherited];
  }, [member, directRoles.currentData, teams.teams, teamRoles.currentData]);

  const columns = useMemo<Array<Column<RoleRow>>>(
    () => [
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
        sortType: 'string',
      },
      {
        id: 'source',
        header: t('admin.user-overview.source', 'Source'),
        sortType: 'string',
        cell: ({ row: { original } }) => (original.team ? <TeamLink team={original.team} /> : original.source),
      },
    ],
    []
  );

  if (isNotMember) {
    return (
      <Alert
        severity="info"
        title={t('admin.user-overview.not-member', 'This user is not a member of the current organization.')}
      />
    );
  }

  const error = teams.error || teamRoles.error || directRoles.error;
  const forbidden = members.isUninitialized || (licensed && (!canReadUserRoles || !canReadTeamRoles));
  return (
    <Stack direction="column" gap={2}>
      {member && <UserRolesEditor member={member} />}
      {(Boolean(members.error) || isMembershipUnknown) && <LoadError error={members.error} />}
      {forbidden && (
        <Alert
          severity="warning"
          title={t('admin.user-overview.forbidden', 'You do not have permission to view this information')}
        />
      )}
      {Boolean(error) && <LoadError error={error} />}
      {(members.isLoading || directRoles.isLoading || teams.isLoading || teamRoles.isLoading) && <LoadState />}
      <InteractiveTable columns={columns} data={rows} getRowId={(row) => row.id} />
    </Stack>
  );
}
