/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { useState, useEffect, useMemo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import {
  Modal,
  Button,
  Field,
  Input,
  InteractiveTable,
  LoadingPlaceholder,
  Column,
  useStyles2,
  IconButton,
  Tooltip,
  Icon,
} from '@grafana/ui';
import { useListRolesQuery, useSetTeamRolesMutation } from 'app/api/clients/roles';
import { Role } from 'app/types/accessControl';

import { RolePermissionsModal } from '../admin/RolePermissionsModal';

interface AddTeamRoleModalProps {
  isOpen: boolean;
  teamId: number;
  currentRoleUids: string[];
  onDismiss: () => void;
  onRoleAdded: () => void;
}

export const AddTeamRoleModal = ({
  isOpen,
  teamId,
  currentRoleUids,
  onDismiss,
  onRoleAdded,
}: AddTeamRoleModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<{ uid: string; name: string } | null>(null);
  const styles = useStyles2(getStyles);

  // Handle dismiss - don't close if permissions modal is open
  const handleDismiss = useCallback(() => {
    if (selectedRoleForPerms) {
      // Don't close the add role modal if permissions modal is open
      return;
    }
    onDismiss();
  }, [selectedRoleForPerms, onDismiss]);

  const { data: allRoles, isLoading } = useListRolesQuery({ delegatable: true });
  const [updateTeamRoles, { isLoading: isUpdating }] = useSetTeamRolesMutation();

  // Show all delegatable roles
  const availableRoles = useMemo(() => {
    if (!allRoles) {
      return [];
    }
    return allRoles.filter((role) => role.delegatable);
  }, [allRoles]);

  // Filter roles by search query
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableRoles;
    }

    const query = searchQuery.toLowerCase();
    return availableRoles.filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        role.displayName?.toLowerCase().includes(query) ||
        role.group?.toLowerCase().includes(query)
    );
  }, [availableRoles, searchQuery]);

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleAddRole = useCallback(
    async (roleUid: string) => {
      try {
        await updateTeamRoles({
          teamId,
          setTeamRolesCommand: {
            roleUids: [...currentRoleUids, roleUid],
          },
        }).unwrap();

        getBackendSrv().get('/api/user').then(() => {
          onRoleAdded();
        });
      } catch (error) {
        console.error('Error adding role to team:', error);
      }
    },
    [teamId, currentRoleUids, updateTeamRoles, onRoleAdded]
  );

  const columns = useMemo<Array<Column<Role>>>(
    () => [
      {
        id: 'group',
        header: 'Group',
        cell: ({ row }) => <span>{row.original.group || 'Other'}</span>,
        sortType: 'string',
      },
      {
        id: 'displayName',
        header: 'Display Name',
        cell: ({ row }) => <span>{row.original.displayName || row.original.name}</span>,
        sortType: 'string',
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => <span>{row.original.name}</span>,
        sortType: 'string',
      },
      {
        id: 'permissions',
        header: '',
        cell: ({ row }) => (
          <Tooltip content="View Permissions">
            <IconButton
              name="eye"
              size="sm"
              variant="secondary"
              onClick={() =>
                setSelectedRoleForPerms({
                  uid: row.original.uid,
                  name: row.original.displayName || row.original.name,
                })
              }
              aria-label="View Permissions"
            />
          </Tooltip>
        ),
      },
      {
        id: 'add',
        header: '',
        cell: ({ row }) => {
          const isAssigned = currentRoleUids.includes(row.original.uid);

          if (isAssigned) {
            return (
              <Tooltip content="Role already assigned">
                <Icon name="check" size="lg" />
              </Tooltip>
            );
          }

          return (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleAddRole(row.original.uid)}
              disabled={isUpdating}
            >
              Add
            </Button>
          );
        },
      },
    ],
    [isUpdating, handleAddRole, currentRoleUids]
  );

  return (
    <>
      <Modal
        title="Add Role to Team"
        isOpen={isOpen}
        onDismiss={handleDismiss}
        className={styles.modal}
        contentClassName={styles.modalContent}
      >
        <div className={styles.content}>
          <Field label="Search roles" noMargin>
            <Input
              placeholder="Search by name, group, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              autoFocus
            />
          </Field>

          {isLoading && <LoadingPlaceholder text="Loading roles..." />}

          {!isLoading && filteredRoles.length === 0 && availableRoles.length === 0 && (
            <div>
              <Trans i18nKey="teams.add-role-modal.no-roles">No delegatable roles available</Trans>
            </div>
          )}

          {!isLoading && filteredRoles.length === 0 && availableRoles.length > 0 && (
            <div>
              <Trans i18nKey="teams.add-role-modal.no-matches">
                No roles found matching &quot;{searchQuery}&quot;
              </Trans>
            </div>
          )}

          {!isLoading && filteredRoles.length > 0 && (
            <InteractiveTable columns={columns} data={filteredRoles} getRowId={(row) => row.uid} />
          )}
        </div>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={handleDismiss}>
            Cancel
          </Button>
        </Modal.ButtonRow>
      </Modal>

      {selectedRoleForPerms && (
        <RolePermissionsModal
          roleUid={selectedRoleForPerms.uid}
          roleName={selectedRoleForPerms.name}
          isOpen={true}
          onDismiss={() => {
            setSelectedRoleForPerms(null);
          }}
        />
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '900px',
    maxWidth: '90vw',
  }),
  modalContent: css({
    overflow: 'visible',
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxHeight: '70vh',
    overflowY: 'auto',
  }),
});
