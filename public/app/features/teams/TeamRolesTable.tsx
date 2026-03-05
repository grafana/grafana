import { css } from '@emotion/css';
import { useMemo, useState, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Column, InteractiveTable, IconButton, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { useSetTeamRolesMutation } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';

import { RolePermissionsModal } from '../admin/RolePermissionsModal';

import { TeamPermissionsModal } from './TeamPermissionsModal';

interface Props {
  roles: Role[];
  teamId: number;
  onRolesChanged: () => void;
}

interface TeamRoleRow {
  id: string;
  roleUid: string;
  roleName: string;
  roleDisplayName: string;
  roleDescription?: string;
  roleGroup: string; // Always has a value, defaults to 'Other'
}

const transformRolesToRows = (roles: Role[]): TeamRoleRow[] => {
  return roles.map((role, index) => {
    // Helper to extract group from role
    const getGroup = (role: Role): string | undefined => {
      // Role type doesn't formally include group but it exists at runtime
      const roleWithGroup: { group?: string } = role;
      return roleWithGroup.group;
    };

    return {
      id: `${role.uid}-${index}`,
      roleUid: role.uid || '',
      roleName: role.name || '',
      roleDisplayName: role.displayName || role.name || 'Unknown',
      roleDescription: role.description,
      roleGroup: getGroup(role) || 'Other',
    };
  });
};

export const TeamRolesTable = ({ roles, teamId, onRolesChanged }: Props) => {
  const [selectedRoleUid, setSelectedRoleUid] = useState<string | null>(null);
  const [selectedRoleName, setSelectedRoleName] = useState<string>('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isTeamPermissionsModalOpen, setIsTeamPermissionsModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const styles = useStyles2(getStyles);

  const [updateTeamRoles] = useSetTeamRolesMutation();

  const canRemoveRoles = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  const rows = useMemo(() => transformRolesToRows(roles), [roles]);

  const handleRemoveRole = useCallback(
    async (roleUidToRemove: string) => {
      try {
        setIsRemoving(true);

        // Filter out the role to remove, keeping only roles that are not mapped
        const remainingRoleUids = roles
          .filter((role) => role.uid !== roleUidToRemove && !role.mapped)
          .map((role) => role.uid);

        // Update team roles with remaining roles
        await updateTeamRoles({
          teamId,
          setTeamRolesCommand: {
            roleUids: remainingRoleUids,
          },
        }).unwrap();

        // Reload the data
        onRolesChanged();
      } catch (error) {
        console.error('Error removing role from team:', error);
      } finally {
        setIsRemoving(false);
      }
    },
    [roles, teamId, updateTeamRoles, onRolesChanged]
  );

  const columns = useMemo<Array<Column<TeamRoleRow>>>(() => {
    const cols: Array<Column<TeamRoleRow>> = [
      {
        id: 'roleGroup',
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
        header: 'Name',
        cell: ({ row }) => <span>{row.original.roleDisplayName}</span>,
        sortType: 'string',
      },
      {
        id: 'roleName',
        header: 'Role',
        cell: ({ row }) => <span className={styles.roleId}>{row.original.roleName}</span>,
        sortType: 'string',
      },
      {
        id: 'permissions',
        header: () => (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Tooltip
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              content="View All Team Permissions"
            >
              <IconButton
                name="eye"
                size="sm"
                variant="secondary"
                onClick={() => setIsTeamPermissionsModalOpen(true)}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                aria-label="View All Team Permissions"
              />
            </Tooltip>
          </div>
        ),
        cell: ({ row }) => (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Tooltip
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              content="View Role Permissions"
            >
              <IconButton
                name="eye"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedRoleUid(row.original.roleUid);
                  setSelectedRoleName(row.original.roleDisplayName);
                  setIsRoleModalOpen(true);
                }}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                aria-label="View Role Permissions"
              />
            </Tooltip>
          </div>
        ),
      },
      {
        id: 'remove',
        header: '',
        cell: ({ row }) => {
          // Only show if user has permission
          if (!canRemoveRoles) {
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
  }, [isRemoving, handleRemoveRole, canRemoveRoles, styles.roleId]);

  const handleRoleModalDismiss = () => {
    setIsRoleModalOpen(false);
    setSelectedRoleUid(null);
    setSelectedRoleName('');
  };

  if (rows.length === 0) {
    return (
      <div>
        <Trans i18nKey="teams.roles.no-roles">No roles assigned to this team.</Trans>
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
          isOpen={isRoleModalOpen}
          onDismiss={handleRoleModalDismiss}
        />
      )}
      <TeamPermissionsModal
        teamId={teamId}
        isOpen={isTeamPermissionsModalOpen}
        onDismiss={() => setIsTeamPermissionsModalOpen(false)}
      />
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  roleId: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    wordBreak: 'break-all',
  }),
});
