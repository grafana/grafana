import React from 'react';

import { Button, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import {
  getNewDashboardPhrase,
  getNewFolderPhrase,
  getImportPhrase,
  getNewPhrase,
} from 'app/features/search/tempI18nPhrases';

interface Props {
  /**
   * Pass a folder UID in which the dashboard or folder will be created
   */
  inFolder?: string;
}

export function CreateNewButton({ inFolder }: Props) {
  const newMenu = (
    <Menu>
      <MenuItem url={addFolderUidToUrl('/dashboard/new', inFolder)} label={getNewDashboardPhrase()} />
      <MenuItem url={addFolderUidToUrl('/dashboards/folder/new', inFolder)} label={getNewFolderPhrase()} />
      <MenuItem url={addFolderUidToUrl('/dashboard/import', inFolder)} label={getImportPhrase()} />
    </Menu>
  );

  return (
    <Dropdown overlay={newMenu}>
      <Button>
        {getNewPhrase()}
        <Icon name="angle-down" />
      </Button>
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
