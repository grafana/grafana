import React, { FC } from 'react';

import { config } from '@grafana/runtime';
import { Menu, Dropdown, Button, Icon } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
        {canCreateDashboards && (
          <Menu.Item url={actionUrl('new')} label={t('search.dashboard-actions.new-dashboard', 'New Dashboard')} />
        )}
        {canCreateFolders && (config.featureToggles.nestedFolders || !folderUid) && (
          <Menu.Item url={actionUrl('new_folder')} label={t('search.dashboard-actions.new-folder', 'New Folder')} />
        )}
        {canCreateDashboards && (
          <Menu.Item url={actionUrl('import')} label={t('search.dashboard-actions.import', 'Import')} />
        )}
      </Menu>
    );
  };

  return (
    <div>
      <Dropdown overlay={MenuActions} placement="bottom-start">
        <Button variant="primary">
          {t('search.dashboard-actions.new', 'New')}
          <Icon name="angle-down" />
        </Button>
      </Dropdown>
    </div>
  );
};
