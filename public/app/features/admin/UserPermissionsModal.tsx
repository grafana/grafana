import { useState, useEffect, useMemo } from 'react';

import { Trans } from '@grafana/i18n';
import { Column, InteractiveTable, LoadingPlaceholder, Modal, Stack, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

import { getBackendSrv } from '@grafana/runtime';

interface Props {
  userId: number;
  userName: string;
  isOpen: boolean;
  onDismiss: () => void;
}

interface Permission {
  id: string;
  action: string;
  scope?: string;
}

interface PermissionResponse {
  action: string;
  scope?: string;
}

export const UserPermissionsModal = ({ userId, userName, isOpen, onDismiss }: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (isOpen && userId) {
      setIsLoading(true);
      setError(null);

      getBackendSrv()
        .get<PermissionResponse[]>(`/api/access-control/users/${userId}/permissions`)
        .then((response) => {
          // Transform the response into a list with IDs for the table
          const perms: Permission[] = response.map((perm, index) => ({
            id: `${perm.action}-${perm.scope || '*'}-${index}`,
            action: perm.action,
            scope: perm.scope || '*',
          }));

          setPermissions(perms);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching user permissions:', err);
          setError(err.data?.message || err.message || 'Failed to load permissions');
          setIsLoading(false);
        });
    }
  }, [isOpen, userId]);

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
      title={`All Permissions for ${userName}`}
      isOpen={isOpen}
      onDismiss={onDismiss}
    >
      {isLoading && <LoadingPlaceholder text="Loading permissions..." />}
      {error && <div>Error: {error}</div>}
      {!isLoading && !error && (
        <Stack direction="column" gap={2}>
          {/* Description */}
          <div>
            <p>This shows the aggregate of all permissions assigned through roles.</p>
          </div>

          {/* Permissions table */}
          {permissions.length > 0 ? (
            <InteractiveTable columns={columns} data={permissions} getRowId={(row) => row.id} />
          ) : (
            <div>
              <Trans i18nKey="admin.user-permissions-modal.no-permissions">
                No permissions found for this user.
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
