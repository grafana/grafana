import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { createNewFolder } from 'app/features/folders/state/actions';
import {
  getNewDashboardPhrase,
  getNewFolderPhrase,
  getImportPhrase,
  getNewPhrase,
} from 'app/features/search/tempI18nPhrases';

import { NewFolderForm } from './NewFolderForm';

const mapDispatchToProps = {
  createNewFolder,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {
  parentFolderTitle?: string;
  /**
   * Pass a folder UID in which the dashboard or folder will be created
   */
  parentFolderUid?: string;
  canCreateFolder: boolean;
  canCreateDashboard: boolean;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

function CreateNewButton({
  parentFolderTitle,
  parentFolderUid,
  canCreateDashboard,
  canCreateFolder,
  createNewFolder,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewFolderDrawer, setShowNewFolderDrawer] = useState(false);

  const onCreateFolder = (folderName: string) => {
    createNewFolder(folderName, parentFolderUid);
    setShowNewFolderDrawer(false);
  };

  const newMenu = (
    <Menu>
      {canCreateDashboard && (
        <MenuItem url={addFolderUidToUrl('/dashboard/new', parentFolderUid)} label={getNewDashboardPhrase()} />
      )}
      {canCreateFolder && <MenuItem onClick={() => setShowNewFolderDrawer(true)} label={getNewFolderPhrase()} />}
      {canCreateDashboard && (
        <MenuItem url={addFolderUidToUrl('/dashboard/import', parentFolderUid)} label={getImportPhrase()} />
      )}
    </Menu>
  );

  return (
    <>
      <Dropdown overlay={newMenu} onVisibleChange={setIsOpen}>
        <Button>
          {getNewPhrase()}
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </Button>
      </Dropdown>
      {showNewFolderDrawer && (
        <Drawer
          title={getNewFolderPhrase()}
          subtitle={parentFolderTitle ? `Location: ${parentFolderTitle}` : undefined}
          scrollableContent
          onClose={() => setShowNewFolderDrawer(false)}
          size="sm"
        >
          <NewFolderForm onConfirm={onCreateFolder} onCancel={() => setShowNewFolderDrawer(false)} />
        </Drawer>
      )}
    </>
  );
}

export default connector(CreateNewButton);

/**
 *
 * @param url without any parameters
 * @param folderUid  folder id
 * @returns url with paramter if folder is present
 */
function addFolderUidToUrl(url: string, folderUid: string | undefined) {
  return folderUid ? url + '?folderUid=' + folderUid : url;
}
