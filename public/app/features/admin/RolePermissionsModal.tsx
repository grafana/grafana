import { useState, useEffect, useMemo } from 'react';

import { Trans } from '@grafana/i18n';
import { Column, InteractiveTable, LoadingPlaceholder, Modal, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

import { getBackendSrv } from '@grafana/runtime';

interface Props {
  roleUid: string;
  roleName: string;
  isOpen: boolean;
  onDismiss: () => void;
}

interface Permission {
  id: string;
  action: string;
  scope?: string;
}

interface RoleWithPermissions {
  uid: string;
  name: string;
  displayName?: string;
  description?: string;
  permissions?: Array<{
    action: string;
    scope?: string;
  }>;
}

export const RolePermissionsModal = ({ roleUid, roleName, isOpen, onDismiss }: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (isOpen && roleUid) {
      setIsLoading(true);
      setError(null);

      // Fetch role details directly by UID (works for both basic and custom roles)
      getBackendSrv()
        .get<RoleWithPermissions>(`/api/access-control/roles/${roleUid}`)
        .then((role) => {
          if (!role) {
            setError(`Role "${roleUid}" not found`);
            setIsLoading(false);
            return;
          }

          const perms: Permission[] = (role.permissions || []).map((perm, index) => ({
            id: `${perm.action}-${perm.scope || 'all'}-${index}`,
            action: perm.action,
            scope: perm.scope || '*',
          }));
          setPermissions(perms);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching role permissions:', err);
          setError(err.data?.message || err.message || 'Failed to load permissions');
          setIsLoading(false);
        });
    }
  }, [isOpen, roleUid]);

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
      title={`Permissions for ${roleName}`}
      isOpen={isOpen}
      onDismiss={onDismiss}
    >
      {isLoading && <LoadingPlaceholder text="Loading permissions..." />}
      {error && <div>Error: {error}</div>}
      {!isLoading && !error && permissions.length > 0 && (
        <InteractiveTable columns={columns} data={permissions} getRowId={(row) => row.id} />
      )}
      {!isLoading && !error && permissions.length === 0 && (
        <div>
          <Trans i18nKey="admin.user-permissions.no-permissions">No permissions found for this role.</Trans>
        </div>
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
