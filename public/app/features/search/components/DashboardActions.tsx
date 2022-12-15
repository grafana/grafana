import React, { FC } from 'react';

import { config } from '@grafana/runtime';
import { Menu, Dropdown, Button, Icon } from '@grafana/ui';

export interface Props {
  folderUid?: string;
  canCreateFolders?: boolean;
  canCreateDashboards?: boolean;
}

export const DashboardActions: FC<Props> = ({ folderUid, canCreateFolders = false, canCreateDashboards = false }) => {
  const actionUrl = (type: string) => {
    let url = `dashboard/${type}`;
    const isTypeNewFolder = type === 'new_folder';

    if (isTypeNewFolder) {
      url = `dashboards/folder/new/`;
    }

    if (folderUid) {
      url += `?folderUid=${folderUid}`;
    }

    return url;
  };

  const MenuActions = () => {
    return (
      <Menu>
        {canCreateDashboards && <Menu.Item url={actionUrl('new')} label="New Dashboard" />}
        {canCreateFolders && (config.featureToggles.nestedFolders || !folderUid) && (
          <Menu.Item url={actionUrl('new_folder')} label="New Folder" />
        )}
        {canCreateDashboards && <Menu.Item url={actionUrl('import')} label="Import" />}
      </Menu>
    );
  };

  return (
    <div>
      <Dropdown overlay={MenuActions} placement="bottom-start">
        <Button variant="primary">
          New
          <Icon name="angle-down" />
        </Button>
      </Dropdown>
    </div>
  );
};
