import { css } from '@emotion/css';
import { useState, useEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Column, InteractiveTable, LoadingPlaceholder, Modal, Stack, useStyles2 } from '@grafana/ui';
import { Role } from 'app/types/accessControl';

interface Props {
  teamId: number;
  isOpen: boolean;
  onDismiss: () => void;
}

interface Permission {
  id: string;
  action: string;
  scope?: string;
}

interface RolePermission {
  action: string;
  scope?: string;
}

export const TeamPermissionsModal = ({ teamId, isOpen, onDismiss }: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (isOpen && teamId) {
      setIsLoading(true);
      setError(null);

      // Fetch team roles first
      getBackendSrv()
        .get<Role[]>(`/api/access-control/teams/${teamId}/roles`)
        .then(async (roles) => {
          console.log('Team roles:', roles);

          if (roles.length === 0) {
            console.log('No roles assigned to team');
            setPermissions([]);
            setIsLoading(false);
            return;
          }

          // Fetch full role details for each role (includes permissions)
          const permissionPromises = roles.map((role) =>
            getBackendSrv()
              .get<Role>(`/api/access-control/roles/${role.uid}`)
              .then((roleDetails) => {
                console.log(`Role details for ${role.uid}:`, roleDetails);
                return roleDetails.permissions || [];
              })
              .catch((err) => {
                console.error(`Error fetching role details for ${role.uid}:`, err);
                return [];
              })
          );

          const allRolePermissions = await Promise.all(permissionPromises);
          console.log('All role permissions:', allRolePermissions);

          // Flatten and deduplicate permissions by action+scope
          const permissionMap = new Map<string, Permission>();
          allRolePermissions.flat().forEach((perm) => {
            const key = `${perm.action}-${perm.scope || '*'}`;
            if (!permissionMap.has(key)) {
              permissionMap.set(key, {
                id: key,
                action: perm.action,
                scope: perm.scope || '*',
              });
            }
          });

          const finalPermissions = Array.from(permissionMap.values());
          console.log('Final aggregated permissions:', finalPermissions);
          setPermissions(finalPermissions);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching team roles:', err);
          setError(err.data?.message || err.message || 'Failed to load permissions');
          setIsLoading(false);
        });
    }
  }, [isOpen, teamId]);

  const columns = useMemo<Array<Column<Permission>>>(
    () => [
      {
        id: 'action',
        header: 'Action',
        cell: ({ row }) => <span>{row.original.action}</span>,
        sortType: 'string',
      },
      {
        id: 'scope',
        header: 'Scope',
        cell: ({ row }) => <span>{row.original.scope || '*'}</span>,
        sortType: 'string',
      },
    ],
    []
  );

  return (
    <Modal
      className={styles.modal}
      contentClassName={styles.modalContent}
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      title="All Team Permissions"
      isOpen={isOpen}
      onDismiss={onDismiss}
    >
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      {isLoading && <LoadingPlaceholder text="Loading permissions..." />}
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      {error && <div>Error: {error}</div>}
      {!isLoading && !error && (
        <Stack direction="column" gap={2}>
          {/* Description */}
          <div>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            <p>This shows the aggregate of all permissions assigned through roles.</p>
          </div>

          {/* Permissions table */}
          {permissions.length > 0 ? (
            <InteractiveTable columns={columns} data={permissions} getRowId={(row) => row.id} />
          ) : (
            <div>
              <Trans i18nKey="teams.permissions-modal.no-permissions">
                No permissions found for this team.
              </Trans>
            </div>
          )}
        </Stack>
      )}
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '900px',
    maxWidth: '90vw',
  }),
  modalContent: css({
    maxHeight: '70vh',
    overflowY: 'auto',
  }),
});
