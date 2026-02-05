import { useState } from 'react';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Box, Button, Drawer, Dropdown, Icon, Menu, MenuItem, Modal, Stack, Text } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Permissions } from 'app/core/components/AccessControl/Permissions';
import { ManageOwnerReferences } from 'app/core/components/OwnerReferences/ManageOwnerReferences';
import { RepoType } from 'app/features/provisioning/Wizard/types';
import { BulkMoveProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkMoveProvisionedResource';
import { DeleteProvisionedFolderForm } from 'app/features/provisioning/components/Folders/DeleteProvisionedFolderForm';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { ShowModalReactEvent } from 'app/types/events';
import { FolderDTO } from 'app/types/folders';

import { useDeleteFolderMutationFacade, useMoveFolderMutationFacade } from '../../../api/clients/folder/v1beta1/hooks';
import { ManagerKind } from '../../apiserver/types';
import { getFolderPermissions } from '../permissions';

import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';

interface Props {
  folder: FolderDTO;
  /* If the folder is managed by a provisioned repo and is read-only */
  isReadOnlyRepo?: boolean;
  repoType?: RepoType;
}

export function FolderActionsButton({ folder, repoType, isReadOnlyRepo }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const [showManageOwnersModal, setShowManageOwnersModal] = useState(false);
  const [showDeleteProvisionedFolderDrawer, setShowDeleteProvisionedFolderDrawer] = useState(false);
  const [showMoveProvisionedFolderDrawer, setShowMoveProvisionedFolderDrawer] = useState(false);
  const [moveFolder] = useMoveFolderMutationFacade();
  const isProvisionedInstance = useIsProvisionedInstance();

  const deleteFolder = useDeleteFolderMutationFacade();

  const {
    canEditFolders,
    canDeleteFolders: canDeleteFoldersPermissions,
    canViewPermissions,
    canSetPermissions,
  } = getFolderPermissions(folder);

  const isProvisionedFolder = folder.managedBy === ManagerKind.Repo;
  const isProvisionedRootFolder = isProvisionedFolder && !isProvisionedInstance && folder.parentUid === undefined;
  // Can only move folders when the folder is not provisioned
  const canMoveFolder = canEditFolders && !isProvisionedRootFolder && !isReadOnlyRepo;
  // Can only delete folders when the folder has the right permission and is not provisioned root folder
  const canDeleteFolders = canDeleteFoldersPermissions && !isProvisionedRootFolder && !isReadOnlyRepo;
  // Show permissions only if the folder is not provisioned
  const canShowPermissions = canViewPermissions && !isProvisionedFolder;

  const onMove = async (destinationUID: string) => {
    await moveFolder({ folderUID: folder.uid, destinationUID: destinationUID });
    reportInteraction('grafana_manage_dashboards_item_moved', {
      item_counts: {
        folder: 1,
        dashboard: 0,
      },
      source: 'folder_actions',
    });
  };

  const onDelete = async () => {
    const result = await deleteFolder(folder);

    if (result.error) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t(
            'browse-dashboards.folder-actions-button.delete-folder-error',
            'Error deleting folder. Please try again later.'
          ),
        ],
      });
      return;
    }

    reportInteraction('grafana_manage_dashboards_item_deleted', {
      item_counts: {
        folder: 1,
        dashboard: 0,
      },
      source: 'folder_actions',
    });
    const { parents } = folder;
    const parentUrl = parents && parents.length ? parents[parents.length - 1].url : '/dashboards';
    locationService.push(parentUrl);
  };

  const showMoveModal = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: MoveModal,
        props: {
          selectedItems: {
            folder: { [folder.uid]: true },
            dashboard: {},
            panel: {},
            $all: false,
          },
          onConfirm: onMove,
        },
      })
    );
  };

  const showDeleteModal = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: DeleteModal,
        props: {
          selectedItems: {
            folder: { [folder.uid]: true },
            dashboard: {},
            panel: {},
            $all: false,
          },
          onConfirm: onDelete,
        },
      })
    );
  };

  const showDeleteProvisionedModal = () => {
    setShowDeleteProvisionedFolderDrawer(true);
  };

  const handleShowMoveProvisionedFolderDrawer = () => {
    setShowMoveProvisionedFolderDrawer(true);
  };

  const managePermissionsLabel = t('browse-dashboards.folder-actions-button.manage-permissions', 'Manage permissions');
  const manageOwnersLabel = t('manage-owner-references.manage-folder-owner', 'Manage folder owner');
  const moveLabel = t('browse-dashboards.folder-actions-button.move', 'Move this folder');
  const deleteLabel = t('browse-dashboards.folder-actions-button.delete', 'Delete this folder');

  const showManageOwners = canViewPermissions && !isProvisionedFolder;

  const menu = (
    <Menu>
      {canViewPermissions && !isProvisionedFolder && (
        <MenuItem onClick={() => setShowPermissionsDrawer(true)} label={managePermissionsLabel} />
      )}
      {showManageOwners && (
        <MenuItem
          onClick={() => {
            reportInteraction('grafana_folder_actions_manage_owners_clicked');
            setShowManageOwnersModal(true);
          }}
          label={manageOwnersLabel}
        />
      )}
      {canMoveFolder && !isReadOnlyRepo && (
        <MenuItem
          onClick={isProvisionedFolder ? handleShowMoveProvisionedFolderDrawer : showMoveModal}
          label={moveLabel}
        />
      )}
      {canDeleteFolders && (
        <MenuItem
          destructive
          onClick={isProvisionedFolder ? showDeleteProvisionedModal : showDeleteModal}
          label={deleteLabel}
        />
      )}
    </Menu>
  );

  if (!canShowPermissions && !canMoveFolder && !canDeleteFolders) {
    return null;
  }

  return (
    <>
      <Dropdown overlay={menu} onVisibleChange={setIsOpen}>
        <Button variant="secondary" disabled={isReadOnlyRepo && !canViewPermissions}>
          <Trans i18nKey="browse-dashboards.folder-actions-button.folder-actions">Folder actions</Trans>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </Button>
      </Dropdown>
      {showPermissionsDrawer && (
        <Drawer
          title={t('browse-dashboards.action.manage-permissions-button', 'Manage permissions')}
          subtitle={folder.title}
          onClose={() => setShowPermissionsDrawer(false)}
          size="md"
        >
          <Permissions resource="folders" resourceId={folder.uid} canSetPermissions={canSetPermissions} />
        </Drawer>
      )}
      {showManageOwnersModal && (
        <Modal
          title={t('manage-owner-references.manage-folder-owner', 'Manage folder owner')}
          isOpen={showManageOwnersModal}
          onDismiss={() => setShowManageOwnersModal(false)}
        >
          <Stack gap={1} direction="column">
            <Text element="p">
              <Trans i18nKey="manage-owner-references.manage-folder-owner-alert-title">
                Select a team to own this folder to help organise your resources.
              </Trans>
            </Text>
            <Text element="p">
              <Trans i18nKey="manage-owner-references.manage-folder-owner-alert-text">
                Folders owned by teams that you belong to will be prioritised for you in the folder picker and other
                locations.
              </Trans>
            </Text>
            <Box paddingTop={1}>
              <ManageOwnerReferences
                resourceId={folder.uid}
                onSave={() => {
                  setShowManageOwnersModal(false);
                }}
                onRemove={() => {
                  setShowManageOwnersModal(false);
                }}
              />
            </Box>
          </Stack>
        </Modal>
      )}
      {showDeleteProvisionedFolderDrawer && (
        <Drawer
          title={
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.delete-provisioned-folder', 'Delete provisioned folder')}
            </Text>
          }
          subtitle={folder.title}
          onClose={() => setShowDeleteProvisionedFolderDrawer(false)}
        >
          <DeleteProvisionedFolderForm
            parentFolder={folder}
            onDismiss={() => setShowDeleteProvisionedFolderDrawer(false)}
          />
        </Drawer>
      )}
      {showMoveProvisionedFolderDrawer && (
        <Drawer
          title={
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.move-provisioned-folder', 'Move provisioned folder')}
            </Text>
          }
          subtitle={folder.title}
          onClose={() => setShowMoveProvisionedFolderDrawer(false)}
        >
          <BulkMoveProvisionedResource
            folderUid={folder.uid}
            selectedItems={{ dashboard: {}, folder: { [folder.uid]: true } }}
            onDismiss={() => setShowMoveProvisionedFolderDrawer(false)}
          />
        </Drawer>
      )}
    </>
  );
}
