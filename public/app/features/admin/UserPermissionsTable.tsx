import { useMemo, useState, useCallback } from 'react';

import { Trans } from '@grafana/i18n';
import { Column, InteractiveTable, TextLink, IconButton, Tooltip } from '@grafana/ui';
import { useSetUserRolesMutation } from 'app/api/clients/roles';
import { Role } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';
import { UserOrg } from 'app/types/user';

import { RolePermissionsModal } from './RolePermissionsModal';
import { UserPermissionsModal } from './UserPermissionsModal';

interface Props {
  roles: Role[];
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
  orgName: string; // Always has a value
}

const transformRolesToPermissionRows = (
  roles: Role[],
  teams: TeamWithRoles[],
  orgs: UserOrg[]
): PermissionRow[] => {
  const rows: PermissionRow[] = [];
  // Use first org name as default, since we're viewing a single user
  const orgName = orgs.length > 0 ? orgs[0].name : 'Unknown';

  // Create a map of roleUid to teams
  const roleTeamMap = new Map<string, TeamWithRoles[]>();
  teams.forEach((team) => {
    if (team.roles) {
      team.roles.forEach((role: Role) => {
        const existing = roleTeamMap.get(role.uid) || [];
        roleTeamMap.set(role.uid, [...existing, team]);
      });
    }
  });

  let rowCounter = 0;
  const processedRoleUids = new Set<string>();

  // Helper to extract group from role
  const getGroup = (role: Role): string | undefined => {
    return (role as Role & { group?: string }).group;
  };

  // Process roles from the user roles API
  roles.forEach((role) => {
    processedRoleUids.add(role.uid);
    const teamsWithRole = roleTeamMap.get(role.uid) || [];
    const isBasic = role.name.startsWith('basic:');
    const isMapped = Boolean(role.mapped);

    // Determine sources
    const hasTeams = teamsWithRole.length > 0;
    const hasOrgRole = isBasic;
    const hasExternal = isMapped;
    // A role can be BOTH directly assigned AND inherited from teams
    // Show as direct if it's not a basic org role and not external/mapped
    const hasDirect = !hasOrgRole && !hasExternal;

    // Create row for each team
    if (hasTeams) {
      teamsWithRole.forEach((team) => {
        rows.push({
          id: `${role.uid}-team-${team.id}`,
          roleUid: role.uid || '',
          roleName: role.name || '',
          roleDisplayName: role.displayName || role.name || 'Unknown',
          roleDescription: role.description,
          roleGroup: getGroup(role) || 'Other',
          source: team.name || 'Unknown Team',
          sourceType: 'team',
          teamUid: team.uid,
          orgName: orgName || 'Unknown Org',
        });
      });
    }

    // Create row for org role
    if (hasOrgRole) {
      rows.push({
        id: `${role.uid}-org-${rowCounter++}`,
        roleUid: role.uid || '',
        roleName: role.name || '',
        roleDisplayName: role.displayName || role.name || 'Unknown',
        roleDescription: role.description,
        roleGroup: (role as any).group || 'Other',
        source: 'Organization Role',
        sourceType: 'org',
        orgName: orgName || 'Unknown Org',
      });
    }

    // Create row for external
    if (hasExternal) {
      rows.push({
        id: `${role.uid}-external-${rowCounter++}`,
        roleUid: role.uid || '',
        roleName: role.name || '',
        roleDisplayName: role.displayName || role.name || 'Unknown',
        roleDescription: role.description,
        roleGroup: (role as any).group || 'Other',
        source: 'External (LDAP/OAuth)',
        sourceType: 'external',
        orgName: orgName || 'Unknown Org',
      });
    }

    // Create row for direct assignment
    if (hasDirect) {
      rows.push({
        id: `${role.uid}-direct-${rowCounter++}`,
        roleUid: role.uid || '',
        roleName: role.name || '',
        roleDisplayName: role.displayName || role.name || 'Unknown',
        roleDescription: role.description,
        roleGroup: (role as any).group || 'Other',
        source: 'Direct',
        sourceType: 'direct',
        orgName: orgName || 'Unknown Org',
      });
    }
  });

  // Process team roles that weren't in the user roles API response
  teams.forEach((team) => {
    if (team.roles) {
      team.roles.forEach((role: Role) => {
        if (!processedRoleUids.has(role.uid)) {
          processedRoleUids.add(role.uid);
          const teamsWithRole = roleTeamMap.get(role.uid) || [];

          // Create row for each team that has this role
          teamsWithRole.forEach((t) => {
            rows.push({
              id: `${role.uid}-team-${t.id}`,
              roleUid: role.uid || '',
              roleName: role.name || '',
              roleDisplayName: role.displayName || role.name || 'Unknown',
              roleDescription: role.description,
              roleGroup: getGroup(role) || 'Other',
              source: t.name || 'Unknown Team',
              sourceType: 'team',
              teamUid: t.uid,
              orgName: orgName || 'Unknown Org',
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
      id: `${basicRoleUid}-org-${org.orgId}`,
      roleUid: basicRoleUid,
      roleName: basicRoleName,
      roleDisplayName: org.role,
      roleDescription: `Organization ${org.role} role`,
      roleGroup: 'Basic',
      source: 'Organization Role',
      sourceType: 'org',
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

  const rows = useMemo(() => transformRolesToPermissionRows(roles, teams, orgs), [roles, teams, orgs]);

  const handleRemoveRole = useCallback(
    async (roleUidToRemove: string) => {
      try {
        setIsRemoving(true);

        // Filter out the role to remove and any mapped roles
        const remainingRoleUids = roles
          .filter((role) => role.uid !== roleUidToRemove && !role.mapped)
          .map((role) => role.uid);

        // Update user roles with remaining roles
        await updateUserRoles({
          userId,
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
        header: 'Display Name',
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
          // Only show for direct roles
          if (row.original.sourceType !== 'direct') {
            return null;
          }

          return (
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            <Tooltip content="Remove role">
              <IconButton
                name="trash-alt"
                size="sm"
                variant="destructive"
                onClick={() => handleRemoveRole(row.original.roleUid)}
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
  }, [isRemoving, handleRemoveRole]);

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
