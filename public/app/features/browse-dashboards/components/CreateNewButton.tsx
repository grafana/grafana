import React from 'react';

import { Button, ButtonGroup, Dropdown, Menu, MenuItem } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props {
  /**
   * Pass a folder UID in which the dashboard or folder will be created
   */
  inFolder?: string;
}

export function CreateNewButton({ inFolder }: Props) {
  const newMenu = (
    <Menu>
      <MenuItem
        url={addFolderUidToUrl('/dashboard/new', inFolder)}
        label={t('search.dashboard-actions.new-dashboard', 'New Dashboard')}
      />
      <MenuItem
        url={addFolderUidToUrl('/dashboards/folder/new', inFolder)}
        label={t('search.dashboard-actions.new-folder', 'New Folder')}
      />
      <MenuItem
        url={addFolderUidToUrl('/dashboard/import', inFolder)}
        label={t('search.dashboard-actions.import', 'Import')}
      />
    </Menu>
  );

  return (
    <Dropdown overlay={newMenu}>
      <ButtonGroup>
        <Button icon="plus">New</Button>
        <Button icon="angle-down" />
      </ButtonGroup>
    </Dropdown>
  );
}

/**
 *
 * @param url without any parameters
 * @param folderUid  folder id
 * @returns url with paramter if folder is present
 */
function addFolderUidToUrl(url: string, folderUid: string | undefined) {
  return folderUid ? url + '?folderUid=' + folderUid : url;
}
