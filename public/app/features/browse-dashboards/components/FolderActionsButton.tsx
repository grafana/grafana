import React, { useState } from 'react';

import { locationService } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl';
import { appEvents, contextSrv } from 'app/core/core';
import { AccessControlAction, FolderDTO, useDispatch } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useMoveFolderMutation } from '../api/browseDashboardsAPI';
import { deleteFolder, fetchChildren } from '../state';

import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';

interface Props {
  folder: FolderDTO;
}

export function FolderActionsButton({ folder }: Props) {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const [moveFolder] = useMoveFolderMutation();
  const canViewPermissions = contextSrv.hasPermission(AccessControlAction.FoldersPermissionsRead);
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.FoldersPermissionsWrite);
  const canMoveFolder = contextSrv.hasPermission(AccessControlAction.FoldersWrite);
  const canDeleteFolder = contextSrv.hasPermission(AccessControlAction.FoldersDelete);

  const onMove = async (destinationUID: string) => {
    await moveFolder({ folderUID: folder.uid, destinationUID });
    dispatch(fetchChildren(destinationUID));
    if (folder.parentUid) {
      dispatch(fetchChildren(folder.parentUid));
    }
  };

  const onDelete = async () => {
    await dispatch(deleteFolder(folder.uid));
    if (folder.parentUid) {
      dispatch(fetchChildren(folder.parentUid));
    }
    locationService.push('/dashboards');
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

  const menu = (
    <Menu>
      {canViewPermissions && <MenuItem onClick={() => setShowPermissionsDrawer(true)} label="Manage permissions" />}
      {canMoveFolder && <MenuItem onClick={showMoveModal} label="Move" />}
      {canDeleteFolder && <MenuItem destructive onClick={showDeleteModal} label="Delete" />}
    </Menu>
  );

  if (!canViewPermissions && !canMoveFolder && !canDeleteFolder) {
    return null;
  }

  return (
    <>
      <Dropdown overlay={menu} onVisibleChange={setIsOpen}>
        <Button variant="secondary">
          Folder actions
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </Button>
      </Dropdown>
      {showPermissionsDrawer && (
        <Drawer
          title="Permissions"
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
