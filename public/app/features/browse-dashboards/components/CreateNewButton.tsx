import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { createNewFolder } from 'app/features/folders/state/actions';
import {
  getNewDashboardPhrase,
  getNewFolderPhrase,
  getImportPhrase,
  getNewPhrase,
} from 'app/features/search/tempI18nPhrases';
import { FolderDTO } from 'app/types';

import { NewFolderForm } from './NewFolderForm';

const mapDispatchToProps = {
  createNewFolder,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {
  parentFolder?: FolderDTO;
  canCreateFolder: boolean;
  canCreateDashboard: boolean;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

function CreateNewButton({ parentFolder, canCreateDashboard, canCreateFolder, createNewFolder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [showNewFolderDrawer, setShowNewFolderDrawer] = useState(false);

  const onCreateFolder = (folderName: string) => {
    createNewFolder(folderName, parentFolder?.uid);
    const depth = parentFolder?.parents ? parentFolder.parents.length + 1 : 0;
    reportInteraction('grafana_manage_dashboards_folder_created', {
      is_subfolder: Boolean(parentFolder?.uid),
      folder_depth: depth,
    });
    setShowNewFolderDrawer(false);
  };

  const newMenu = (
    <Menu>
      {canCreateDashboard && (
        <MenuItem
          label={getNewDashboardPhrase()}
          onClick={() =>
            reportInteraction('grafana_menu_item_clicked', {
              url: addFolderUidToUrl('/dashboard/new', parentFolder?.uid),
              from: location.pathname,
            })
          }
          url={addFolderUidToUrl('/dashboard/new', parentFolder?.uid)}
        />
      )}
      {canCreateFolder && <MenuItem onClick={() => setShowNewFolderDrawer(true)} label={getNewFolderPhrase()} />}
      {canCreateDashboard && (
        <MenuItem
          label={getImportPhrase()}
          onClick={() =>
            reportInteraction('grafana_menu_item_clicked', {
              url: addFolderUidToUrl('/dashboard/import', parentFolder?.uid),
              from: location.pathname,
            })
          }
          url={addFolderUidToUrl('/dashboard/import', parentFolder?.uid)}
        />
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
          subtitle={parentFolder?.title ? `Location: ${parentFolder.title}` : undefined}
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
