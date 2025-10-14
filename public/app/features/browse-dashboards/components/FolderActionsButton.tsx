import { useState } from 'react';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl';
import { appEvents } from 'app/core/core';
import { RepoType } from 'app/features/provisioning/Wizard/types';
import { BulkMoveProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkMoveProvisionedResource';
import { DeleteProvisionedFolderForm } from 'app/features/provisioning/components/Folders/DeleteProvisionedFolderForm';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/repository';
import { ShowModalReactEvent } from 'app/types/events';
import { FolderDTO } from 'app/types/folders';

import { useDeleteFolderMutationFacade, useMoveFolderMutationFacade } from '../../../api/clients/folder/v1beta1/hooks';
import { ManagerKind } from '../../apiserver/types';
import { getFolderPermissions } from '../permissions';

import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';

interface Props {
  folder: FolderDTO;
  isReadOnlyRepo?: boolean;
  repoType?: RepoType;
}

export function FolderActionsButton({ folder, repoType, isReadOnlyRepo }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const [showDeleteProvisionedFolderDrawer, setShowDeleteProvisionedFolderDrawer] = useState(false);
  const [showMoveProvisionedFolderDrawer, setShowMoveProvisionedFolderDrawer] = useState(false);
  const [moveFolder] = useMoveFolderMutationFacade();
  const isProvisionedInstance = useIsProvisionedInstance();

  const deleteFolder = useDeleteFolderMutationFacade();

  const { canEditFolders, canDeleteFolders, canViewPermissions, canSetPermissions } = getFolderPermissions(folder);
  const isProvisionedFolder = folder.managedBy === ManagerKind.Repo;
  // When its single provisioned folder, cannot move the root repository folder
  const isProvisionedRootFolder = isProvisionedFolder && !isProvisionedInstance && folder.parentUid === undefined;
  // Can only move folders when the folder is not provisioned
  const canMoveFolder = canEditFolders && !isProvisionedRootFolder;

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
  const moveLabel = t('browse-dashboards.folder-actions-button.move', 'Move');
  const deleteLabel = t('browse-dashboards.folder-actions-button.delete', 'Delete');

  const menu = (
    <Menu>
      {canViewPermissions && <MenuItem onClick={() => setShowPermissionsDrawer(true)} label={managePermissionsLabel} />}
      {canMoveFolder && !isReadOnlyRepo && (
        <MenuItem
          onClick={isProvisionedFolder ? handleShowMoveProvisionedFolderDrawer : showMoveModal}
          label={moveLabel}
        />
      )}
      {canDeleteFolders && !isReadOnlyRepo && (
        <MenuItem
          destructive
          onClick={isProvisionedFolder ? showDeleteProvisionedModal : showDeleteModal}
          label={deleteLabel}
        />
      )}
    </Menu>
  );

  if (!canViewPermissions && !canMoveFolder && !canDeleteFolders) {
    return null;
  }

  return (
    <>
      <Dropdown overlay={menu} onVisibleChange={setIsOpen}>
        <Button
          variant="secondary"
          disabled={isReadOnlyRepo && !canViewPermissions}
          tooltip={
            isReadOnlyRepo && !canViewPermissions
              ? getReadOnlyTooltipText({ isLocal: repoType === 'local' })
              : undefined
          }
        >
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
      {showDeleteProvisionedFolderDrawer && (
        <Drawer
          title={t('browse-dashboards.action.delete-provisioned-folder', 'Delete provisioned folder')}
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
          title={t('browse-dashboards.action.move-provisioned-folder', 'Move provisioned folder')}
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
