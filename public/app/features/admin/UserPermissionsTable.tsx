import { css } from '@emotion/css';
import { useMemo, useState, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Column, FilterInput, Icon, InteractiveTable, TextLink, IconButton, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
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
  onChangeBasicRole?: () => void;
}

interface PermissionRow {
  id: string;
  roleUid: string;
  roleName: string;
  roleDisplayName: string;
  roleDescription?: string;
  roleGroup: string;
  source: string;
  sourceType: 'direct' | 'org' | 'team' | 'external';
  teamUid?: string;
  orgId: number;
  orgName: string;
  /** Sort priority: 0 = basic role (top), 1 = everything else */
  sortPriority: number;
}

const transformRolesToPermissionRows = (
  roles: RoleWithOrg[],
  teams: TeamWithRoles[],
  orgs: UserOrg[]
): PermissionRow[] => {
  const rows: PermissionRow[] = [];

  const roleTeamMap = new Map<string, TeamWithRoles[]>();
  teams.forEach((team) => {
    if (team.roles) {
      team.roles.forEach((role: Role & { orgId?: number }) => {
        const orgId = role.orgId || team.orgId;
        const key = `${role.uid}-${orgId}`;
        const existing = roleTeamMap.get(key) || [];
        roleTeamMap.set(key, [...existing, team]);
      });
    }
  });

  let rowCounter = 0;
  const processedRoleKeys = new Set<string>();

  const getGroup = (role: Role): string | undefined => {
    const roleWithGroup: { group?: string } = role;
    return roleWithGroup.group;
  };

  roles.forEach((role) => {
    const roleKey = `${role.uid}-${role.orgId}`;
    processedRoleKeys.add(roleKey);
    const teamsWithRole = roleTeamMap.get(roleKey) || [];
    const isBasic = role.name.startsWith('basic:');
    const isMapped = Boolean(role.mapped);

    const hasTeams = teamsWithRole.length > 0;
    const hasOrgRole = isBasic;
    const hasExternal = isMapped;
    const hasDirect = !hasOrgRole && !hasExternal;

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
          sortPriority: 1,
        });
      });
    }

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
        sortPriority: 0,
      });
    }

    if (hasExternal) {
      rows.push({
        id: `${role.orgId}-${role.uid}-external-${rowCounter++}`,
        roleUid: role.uid || '',
        roleName: role.name || '',
        roleDisplayName: role.displayName || role.name || 'Unknown',
        roleDescription: role.description,
        roleGroup: getGroup(role) || 'Other',
        source: 'Identity Provider',
        sourceType: 'external',
        orgId: role.orgId,
        orgName: role.orgName || 'Unknown Org',
        sortPriority: 1,
      });
    }

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
        sortPriority: 1,
      });
    }
  });

  // Process team roles not in user roles API response
  teams.forEach((team) => {
    if (team.roles) {
      team.roles.forEach((role: Role & { orgId?: number; orgName?: string }) => {
        const roleKey = `${role.uid}-${team.orgId}`;
        if (!processedRoleKeys.has(roleKey)) {
          processedRoleKeys.add(roleKey);
          const teamsWithRole = roleTeamMap.get(roleKey) || [];

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
              sortPriority: 1,
            });
          });
        }
      });
    }
  });

  // Add organization basic roles
  orgs.forEach((org) => {
    const basicRoleUid = `basic_${org.role.toLowerCase()}`;
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
      sortPriority: 0,
    });
  });

  // Sort: basic role first, then by group, then by display name
  rows.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) {
      return a.sortPriority - b.sortPriority;
    }
    const groupCmp = a.roleGroup.localeCompare(b.roleGroup);
    if (groupCmp !== 0) {
      return groupCmp;
    }
    return a.roleDisplayName.localeCompare(b.roleDisplayName);
  });

  return rows;
};

/** Icon + label for the Source column */
const SourceCell = ({ row }: { row: PermissionRow }) => {
  const styles = useStyles2(getStyles);

  switch (row.sourceType) {
    case 'team':
      return (
        <span className={styles.sourceCell}>
          <Icon name="users-alt" size="sm" />
          {row.teamUid ? (
            <TextLink href={`/org/teams/edit/${row.teamUid}`} color="primary">
              {row.source}
            </TextLink>
          ) : (
            <span>{row.source}</span>
          )}
        </span>
      );
    case 'org':
      return (
        <span className={styles.sourceCell}>
          <Icon name="shield" size="sm" />
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          <span>Basic Role</span>
        </span>
      );
    case 'external':
      return (
        <span className={styles.sourceCell}>
          <Icon name="lock" size="sm" />
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          <span>Identity Provider</span>
        </span>
      );
    case 'direct':
    default:
      return (
        <span className={styles.sourceCell}>
          <Icon name="user" size="sm" />
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          <span>Direct</span>
        </span>
      );
  }
};

export const UserPermissionsTable = ({ roles, teams, orgs, userId, userName, onRolesChanged, onChangeBasicRole }: Props) => {
  const styles = useStyles2(getStyles);
  const [selectedRoleUid, setSelectedRoleUid] = useState<string | null>(null);
  const [selectedRoleName, setSelectedRoleName] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserPermissionsModalOpen, setIsUserPermissionsModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [updateUserRoles] = useSetUserRolesMutation();

  const canRemoveRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);
  const canChangeOrgRole = contextSrv.hasPermission(AccessControlAction.OrgUsersWrite);

  const allRows = useMemo(() => transformRolesToPermissionRows(roles, teams, orgs), [roles, teams, orgs]);

  // Filter rows by search
  const rows = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRows;
    }
    const q = searchQuery.toLowerCase();
    return allRows.filter(
      (r) =>
        r.roleDisplayName.toLowerCase().includes(q) ||
        r.roleName.toLowerCase().includes(q) ||
        r.roleGroup.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        (r.roleDescription || '').toLowerCase().includes(q)
    );
  }, [allRows, searchQuery]);

  const handleRemoveRole = useCallback(
    async (roleUidToRemove: string, roleOrgId: number) => {
      try {
        setIsRemoving(true);

        const orgRoles = roles.filter((role) => role.orgId === roleOrgId);
        const remainingRoleUids = orgRoles
          .filter((role) => role.uid !== roleUidToRemove && !role.mapped)
          .map((role) => role.uid);

        await updateUserRoles({
          userId,
          targetOrgId: roleOrgId,
          setUserRolesCommand: {
            roleUids: remainingRoleUids,
          },
        }).unwrap();

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
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        header: 'Group',
        cell: ({ row }) => (
          <Text color="secondary" variant="bodySmall">
            {row.original.roleGroup}
          </Text>
        ),
        sortType: 'string',
      },
      {
        id: 'roleDisplayName',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        header: 'Name',
        cell: ({ row }) =>
          row.original.roleDescription ? (
            <Tooltip content={row.original.roleDescription} placement="top-start">
              <span>
                <Text weight="medium">{row.original.roleDisplayName}</Text>
              </span>
            </Tooltip>
          ) : (
            <Text weight="medium">{row.original.roleDisplayName}</Text>
          ),
        sortType: 'string',
      },
      {
        id: 'roleName',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        header: 'Role',
        cell: ({ row }) => (
          <span className={styles.roleId}>
            {row.original.roleName}
          </span>
        ),
        sortType: 'string',
      },
      {
        id: 'source',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        header: 'Source',
        cell: ({ row }) => <SourceCell row={row.original} />,
        sortType: 'string',
      },
      {
        id: 'permissions',
        header: () => (
          <div className={styles.centeredCell}>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            <Tooltip content="View all effective permissions">
              <IconButton
                name="eye"
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
          <div className={styles.centeredCell}>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            <Tooltip content="View permissions in this role">
              <IconButton
                name="eye"
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
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          // Basic role row: show edit icon to change basic role
          if (row.original.sourceType === 'org' && canChangeOrgRole && onChangeBasicRole) {
            return (
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              <Tooltip content="Change basic role">
                <IconButton
                  name="pen"
                  size="sm"
                  onClick={onChangeBasicRole}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  aria-label="Change basic role"
                />
              </Tooltip>
            );
          }

          // Direct role: show remove icon
          if (row.original.sourceType === 'direct' && canRemoveRoles) {
            return (
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              <Tooltip content="Remove role">
                <IconButton
                  name="times"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRemoveRole(row.original.roleUid, row.original.orgId)}
                  disabled={isRemoving}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  aria-label="Remove role"
                />
              </Tooltip>
            );
          }

          return null;
        },
      },
    ];

    return cols;
  }, [styles, isRemoving, handleRemoveRole, canRemoveRoles, canChangeOrgRole, onChangeBasicRole]);

  const handleModalDismiss = () => {
    setIsModalOpen(false);
    setSelectedRoleUid(null);
    setSelectedRoleName('');
  };

  if (allRows.length === 0) {
    return (
      <div>
        <Trans i18nKey="admin.user-permissions.no-roles">No roles assigned to this user.</Trans>
      </div>
    );
  }

  return (
    <>
      <div className={styles.tableHeader}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Text color="secondary" variant="bodySmall">
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            {allRows.length} {allRows.length === 1 ? 'role' : 'roles'} assigned
          </Text>
          {allRows.length > 3 && (
            <div className={styles.searchWrapper}>
              <FilterInput
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                placeholder="Search roles..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          )}
        </Stack>
      </div>

      <InteractiveTable columns={columns} data={rows} getRowId={(row) => row.id} />

      {searchQuery && rows.length === 0 && (
        <Text color="secondary" italic>
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          No roles matching &quot;{searchQuery}&quot;
        </Text>
      )}

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

const getStyles = (theme: GrafanaTheme2) => ({
  tableHeader: css({
    marginBottom: theme.spacing(1),
  }),
  searchWrapper: css({
    maxWidth: 300,
  }),
  sourceCell: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  }),
  centeredCell: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }),
  roleId: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    wordBreak: 'break-all',
  }),
});
