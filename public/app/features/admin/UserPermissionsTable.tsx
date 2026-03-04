import { useMemo, useState, useCallback } from 'react';

import { Trans } from '@grafana/i18n';
import { Column, InteractiveTable, TextLink, IconButton, Tooltip } from '@grafana/ui';
import { useSetUserRolesMutation } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';
import { UserOrg } from 'app/types/user';

import { RolePermissionsModal } from './RolePermissionsModal';
import { UserPermissionsModal } from './UserPermissionsModal';
import { RoleWithOrg } from './UserPermissionsPage';

interface Props {
  roles: RoleWithOrg[];
  teams: TeamWithRoles[];
  orgs: UserOrg[];
  userId: number;
  userName: string;
  onRolesChanged: () => void;
}

interface PermissionRow {
  id: string;
  roleUid: string;
  roleName: string;
  roleDisplayName: string;
  roleDescription?: string;
  roleGroup: string; // Always has a value, defaults to 'Other'
  source: string; // Always has a value
  sourceType: 'direct' | 'org' | 'team' | 'external';
  teamUid?: string;
  orgId: number; // Organization ID this role belongs to
  orgName: string; // Always has a value
}

const transformRolesToPermissionRows = (
  roles: RoleWithOrg[],
  teams: TeamWithRoles[],
  orgs: UserOrg[]
): PermissionRow[] => {
  const rows: PermissionRow[] = [];

  // Create a map of roleUid+orgId to teams for matching
  const roleTeamMap = new Map<string, TeamWithRoles[]>();
  teams.forEach((team) => {
    if (team.roles) {
      team.roles.forEach((role: Role & { orgId?: number }) => {
        // Use role.orgId if available, otherwise fall back to team.orgId
        const orgId = role.orgId || team.orgId;
        const key = `${role.uid}-${orgId}`;
        const existing = roleTeamMap.get(key) || [];
        roleTeamMap.set(key, [...existing, team]);
      });
    }
  });

  let rowCounter = 0;
  const processedRoleKeys = new Set<string>();

  // Helper to extract group from role
  const getGroup = (role: Role): string | undefined => {
    // Role type doesn't formally include group but it exists at runtime
    const roleWithGroup: { group?: string } = role;
    return roleWithGroup.group;
  };

  // Process roles from the user roles API (now with orgId and orgName)
  roles.forEach((role) => {
    const roleKey = `${role.uid}-${role.orgId}`;
    processedRoleKeys.add(roleKey);
    const teamsWithRole = roleTeamMap.get(roleKey) || [];
    const isBasic = role.name.startsWith('basic:');
    const isMapped = Boolean(role.mapped);

    // Determine sources - show all assignments including duplicates
    const hasTeams = teamsWithRole.length > 0;
    const hasOrgRole = isBasic;
    const hasExternal = isMapped;
    // Show direct assignment for all non-basic, non-external roles
    // A role can be shown multiple times if it comes from multiple sources
    const hasDirect = !hasOrgRole && !hasExternal;

    // Create row for each team
    if (hasTeams) {
      teamsWithRole.forEach((team) => {
        rows.push({
          id: `${role.orgId}-${role.uid}-team-${team.id}`,
          roleUid: role.uid || '',
          roleName: role.name || '',
          roleDisplayName: role.displayName || role.name || 'Unknown',
          roleDescription: role.description,
          roleGroup: getGroup(role) || 'Other',
          source: team.name || 'Unknown Team',
          sourceType: 'team',
          teamUid: team.uid,
          orgId: role.orgId,
          orgName: role.orgName || 'Unknown Org',
        });
      });
    }

    // Create row for org role
    if (hasOrgRole) {
      rows.push({
        id: `${role.orgId}-${role.uid}-org-${rowCounter++}`,
        roleUid: role.uid || '',
        roleName: role.name || '',
        roleDisplayName: role.displayName || role.name || 'Unknown',
        roleDescription: role.description,
        roleGroup: getGroup(role) || 'Other',
        source: 'Organization Role',
        sourceType: 'org',
        orgId: role.orgId,
        orgName: role.orgName || 'Unknown Org',
      });
    }

    // Create row for external
    if (hasExternal) {
      rows.push({
        id: `${role.orgId}-${role.uid}-external-${rowCounter++}`,
        roleUid: role.uid || '',
        roleName: role.name || '',
        roleDisplayName: role.displayName || role.name || 'Unknown',
        roleDescription: role.description,
        roleGroup: getGroup(role) || 'Other',
        source: 'External (LDAP/OAuth)',
        sourceType: 'external',
        orgId: role.orgId,
        orgName: role.orgName || 'Unknown Org',
      });
    }

    // Create row for direct assignment
    if (hasDirect) {
      rows.push({
        id: `${role.orgId}-${role.uid}-direct-${rowCounter++}`,
        roleUid: role.uid || '',
        roleName: role.name || '',
        roleDisplayName: role.displayName || role.name || 'Unknown',
        roleDescription: role.description,
        roleGroup: getGroup(role) || 'Other',
        source: 'Direct',
        sourceType: 'direct',
        orgId: role.orgId,
        orgName: role.orgName || 'Unknown Org',
      });
    }
  });

  // Process team roles that weren't in the user roles API response
  teams.forEach((team) => {
    if (team.roles) {
      team.roles.forEach((role: Role & { orgId?: number; orgName?: string }) => {
        const roleKey = `${role.uid}-${team.orgId}`;
        if (!processedRoleKeys.has(roleKey)) {
          processedRoleKeys.add(roleKey);
          const teamsWithRole = roleTeamMap.get(roleKey) || [];

          // Create row for each team that has this role
          teamsWithRole.forEach((t) => {
            rows.push({
              id: `${team.orgId}-${role.uid}-team-${t.id}`,
              roleUid: role.uid || '',
              roleName: role.name || '',
              roleDisplayName: role.displayName || role.name || 'Unknown',
              roleDescription: role.description,
              roleGroup: getGroup(role) || 'Other',
              source: t.name || 'Unknown Team',
              sourceType: 'team',
              teamUid: t.uid,
              orgId: team.orgId || 0,
              orgName: role.orgName || 'Unknown Org',
            });
          });
        }
      });
    }
  });

  // Add organization basic roles from orgs array
  orgs.forEach((org) => {
    // Basic roles use underscore format for UID: basic_viewer, basic_editor, basic_admin
    const basicRoleUid = `basic_${org.role.toLowerCase()}`;
    // But use colon format for display name: basic:viewer
    const basicRoleName = `basic:${org.role.toLowerCase()}`;
    rows.push({
      id: `${org.orgId}-${basicRoleUid}-org`,
      roleUid: basicRoleUid,
      roleName: basicRoleName,
      roleDisplayName: org.role,
      roleDescription: `Organization ${org.role} role`,
      roleGroup: 'Basic',
      source: 'Organization Role',
      sourceType: 'org',
      orgId: org.orgId,
      orgName: org.name,
    });
  });

  return rows;
};

export const UserPermissionsTable = ({ roles, teams, orgs, userId, userName, onRolesChanged }: Props) => {
  const [selectedRoleUid, setSelectedRoleUid] = useState<string | null>(null);
  const [selectedRoleName, setSelectedRoleName] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserPermissionsModalOpen, setIsUserPermissionsModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const [updateUserRoles] = useSetUserRolesMutation();

  const canRemoveRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  const rows = useMemo(() => transformRolesToPermissionRows(roles, teams, orgs), [roles, teams, orgs]);

  const handleRemoveRole = useCallback(
    async (roleUidToRemove: string, roleOrgId: number) => {
      try {
        setIsRemoving(true);

        // Filter roles for THIS org only
        const orgRoles = roles.filter((role) => role.orgId === roleOrgId);
        const remainingRoleUids = orgRoles
          .filter((role) => role.uid !== roleUidToRemove && !role.mapped)
          .map((role) => role.uid);

        // Update user roles with remaining roles for this org
        await updateUserRoles({
          userId,
          targetOrgId: roleOrgId,
          setUserRolesCommand: {
            roleUids: remainingRoleUids,
          },
        }).unwrap();

        // Reload the data
        onRolesChanged();
      } catch (error) {
        console.error('Error removing role from user:', error);
      } finally {
        setIsRemoving(false);
      }
    },
    [roles, userId, updateUserRoles, onRolesChanged]
  );

  const columns = useMemo<Array<Column<PermissionRow>>>(() => {
    const cols: Array<Column<PermissionRow>> = [
      {
        id: 'roleGroup',
        header: 'Group',
        cell: ({ row }) => <span>{row.original.roleGroup}</span>,
        sortType: 'string',
      },
      {
        id: 'roleDisplayName',
        header: 'Name',
        cell: ({ row }) => <span>{row.original.roleDisplayName}</span>,
        sortType: 'string',
      },
      {
        id: 'roleName',
        header: 'Role',
        cell: ({ row }) => <span>{row.original.roleName}</span>,
        sortType: 'string',
      },
      {
        id: 'permissions',
        header: () => (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            <Tooltip content="View All User Permissions">
              <IconButton
                name="search"
                size="sm"
                variant="secondary"
                onClick={() => setIsUserPermissionsModalOpen(true)}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                aria-label="View All User Permissions"
              />
            </Tooltip>
          </div>
        ),
        cell: ({ row }) => (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            <Tooltip content="View Role Permissions">
              <IconButton
                name="search"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedRoleUid(row.original.roleUid);
                  setSelectedRoleName(row.original.roleDisplayName);
                  setIsModalOpen(true);
                }}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                aria-label="View Role Permissions"
              />
            </Tooltip>
          </div>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row }) => {
          if (row.original.sourceType === 'team' && row.original.teamUid) {
            return (
              <TextLink href={`/org/teams/edit/${row.original.teamUid}`} color="primary">
                {row.original.source}
              </TextLink>
            );
          }
          return <span>{row.original.source}</span>;
        },
        sortType: 'string',
      },
      {
        id: 'remove',
        header: '',
        cell: ({ row }) => {
          // Only show for direct roles and if user has permission
          if (row.original.sourceType !== 'direct' || !canRemoveRoles) {
            return null;
          }

          return (
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            <Tooltip content="Remove role">
              <IconButton
                name="trash-alt"
                size="sm"
                variant="destructive"
                onClick={() => handleRemoveRole(row.original.roleUid, row.original.orgId)}
                disabled={isRemoving}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                aria-label="Remove role"
              />
            </Tooltip>
          );
        },
      },
    ];

    return cols;
  }, [isRemoving, handleRemoveRole, canRemoveRoles]);

  const handleModalDismiss = () => {
    setIsModalOpen(false);
    setSelectedRoleUid(null);
    setSelectedRoleName('');
  };

  if (rows.length === 0) {
    return (
      <div>
        <Trans i18nKey="admin.user-permissions.no-roles">No roles assigned to this user.</Trans>
      </div>
    );
  }

  return (
    <>
      <InteractiveTable columns={columns} data={rows} getRowId={(row) => row.id} />
      {selectedRoleUid && (
        <RolePermissionsModal
          roleUid={selectedRoleUid}
          roleName={selectedRoleName}
          isOpen={isModalOpen}
          onDismiss={handleModalDismiss}
        />
      )}
      <UserPermissionsModal
        userId={userId}
        userName={userName}
        isOpen={isUserPermissionsModalOpen}
        onDismiss={() => setIsUserPermissionsModalOpen(false)}
      />
    </>
  );
};
