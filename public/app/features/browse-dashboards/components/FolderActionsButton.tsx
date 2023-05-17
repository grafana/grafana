import React, { useState } from 'react';

import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, FolderDTO } from 'app/types';

interface Props {
  folder: FolderDTO;
}

export function FolderActionsButton({ folder }: Props) {
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.FoldersPermissionsWrite);
  const menu = (
    <Menu>
      <MenuItem onClick={() => setShowPermissionsDrawer(true)} label="Set permissions" />
    </Menu>
  );

  return (
    <>
      <Dropdown overlay={menu}>
        <Button variant="secondary">
          Folder actions
          <Icon name="angle-down" />
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
