import React, { FC } from 'react';

import { HorizontalGroup, LinkButton, Menu, Dropdown, Button, ButtonGroup } from '@grafana/ui';

export interface Props {
  folderId?: number;
  canCreateFolders?: boolean;
  canCreateDashboards?: boolean;
}

export const DashboardActions: FC<Props> = ({ folderId, canCreateFolders = false, canCreateDashboards = false }) => {
  const actionUrl = (type: string) => {
    let url = `dashboard/${type}`;

    if (folderId) {
      url += `?folderId=${folderId}`;
    }

    return url;
  };

  const MenuActions = () => {
    return (
      <Menu>
        {!folderId && canCreateFolders && <Menu.Item url="dashboards/folder/new" label="New Folder" />}
        {canCreateDashboards && <Menu.Item url={actionUrl('import')} label="Import" />}
      </Menu>
    );
  };

  return (
    <div>
      <ButtonGroup>
        {canCreateDashboards && <LinkButton href={actionUrl('new')}>New Dashboard</LinkButton>}
        <Dropdown overlay={MenuActions} placement="bottom-end">
          <Button icon="angle-down" />
        </Dropdown>
      </ButtonGroup>
    </div>
  );
};
