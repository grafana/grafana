import React, { useState } from 'react';

import { locationService, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl';
import { appEvents, contextSrv } from 'app/core/core';
import { t, Trans } from 'app/core/internationalization';
import { AccessControlAction, FolderDTO } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useDeleteFolderMutation, useMoveFolderMutation } from '../api/browseDashboardsAPI';

import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';

interface Props {
  folder: FolderDTO;
}

export function FolderActionsButton({ folder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const [moveFolder] = useMoveFolderMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const canViewPermissions = contextSrv.hasPermission(AccessControlAction.FoldersPermissionsRead);
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.FoldersPermissionsWrite);
  const canMoveFolder = contextSrv.hasPermission(AccessControlAction.FoldersWrite);
  const canDeleteFolder = contextSrv.hasPermission(AccessControlAction.FoldersDelete);

  const onMove = async (destinationUID: string) => {
    await moveFolder({ folder, destinationUID });
    reportInteraction('grafana_manage_dashboards_item_moved', {
      item_counts: {
        folder: 1,
        dashboard: 0,
      },
      source: 'folder_actions',
    });
  };

  const onDelete = async () => {
    await deleteFolder(folder);
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

  const managePermissionsLabel = t('browse-dashboards.folder-actions-button.manage-permissions', 'Manage permissions');
  const moveLabel = t('browse-dashboards.folder-actions-button.move', 'Move');
  const deleteLabel = t('browse-dashboards.folder-actions-button.delete', 'Delete');

  const menu = (
    <Menu>
      {canViewPermissions && <MenuItem onClick={() => setShowPermissionsDrawer(true)} label={managePermissionsLabel} />}
      {canMoveFolder && <MenuItem onClick={showMoveModal} label={moveLabel} />}
      {canDeleteFolder && <MenuItem destructive onClick={showDeleteModal} label={deleteLabel} />}
    </Menu>
  );

  if (!canViewPermissions && !canMoveFolder && !canDeleteFolder) {
    return null;
  }

  return (
    <>
      <Dropdown overlay={menu} onVisibleChange={setIsOpen}>
        <Button variant="secondary">
          <Trans i18nKey="browse-dashboards.folder-actions-button.folder-actions">Folder actions</Trans>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </Button>
      </Dropdown>
      {showPermissionsDrawer && (
        <Drawer
          title={t('browse-dashboards.action.manage-permissions-button', 'Manage permissions')}
          subtitle={folder.title}
          scrollableContent
          onClose={() => setShowPermissionsDrawer(false)}
          size="md"
        >
          <Permissions resource="folders" resourceId={folder.uid} canSetPermissions={canSetPermissions} />
        </Drawer>
      )}
    </>
  );
}
