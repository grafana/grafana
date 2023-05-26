import React, { useState } from 'react';

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
  canCreateFolder: boolean;
  canCreateDashboard: boolean;
}

export function CreateNewButton({ inFolder, canCreateDashboard, canCreateFolder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const newMenu = (
    <Menu>
      {canCreateDashboard && (
        <MenuItem url={addFolderUidToUrl('/dashboard/new', inFolder)} label={getNewDashboardPhrase()} />
      )}
      {canCreateFolder && (
        <MenuItem url={addFolderUidToUrl('/dashboards/folder/new', inFolder)} label={getNewFolderPhrase()} />
      )}
      {canCreateDashboard && (
        <MenuItem url={addFolderUidToUrl('/dashboard/import', inFolder)} label={getImportPhrase()} />
      )}
    </Menu>
  );

  return (
    <Dropdown overlay={newMenu} onVisibleChange={setIsOpen}>
      <Button>
        {getNewPhrase()}
        <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
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
