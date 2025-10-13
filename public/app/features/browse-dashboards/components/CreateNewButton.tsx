import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  getImportPhrase,
  getNewDashboardPhrase,
  getNewFolderPhrase,
  getNewPhrase,
} from 'app/features/search/tempI18nPhrases';
import { FolderDTO } from 'app/types';

import { useNewFolderMutation } from '../api/browseDashboardsAPI';

import { NewFolderForm } from './NewFolderForm';

interface Props {
  parentFolder?: FolderDTO;
  canCreateFolder: boolean;
  canCreateDashboard: boolean;
}

export default function CreateNewButton({ parentFolder, canCreateDashboard, canCreateFolder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [newFolder] = useNewFolderMutation();
  const [showNewFolderDrawer, setShowNewFolderDrawer] = useState(false);
  const notifyApp = useAppNotification();

  const onCreateFolder = async (folderName: string) => {
    try {
      const folder = await newFolder({
        title: folderName,
        parentUid: parentFolder?.uid,
      });

      const depth = parentFolder?.parents ? parentFolder.parents.length + 1 : 0;
      reportInteraction('grafana_manage_dashboards_folder_created', {
        is_subfolder: Boolean(parentFolder?.uid),
        folder_depth: depth,
      });

      if (!folder.error) {
        notifyApp.success('Folder created');
      } else {
        notifyApp.error('Failed to create folder');
      }

      if (folder.data) {
        locationService.push(locationUtil.stripBaseFromUrl(folder.data.url));
      }
    } finally {
      setShowNewFolderDrawer(false);
    }
  };

  const newMenu = (
    <Menu>
      {canCreateDashboard && (
        <MenuItem
          label={getNewDashboardPhrase()}
          onClick={() =>
            reportInteraction('grafana_menu_item_clicked', {
              url: buildUrl('/dashboard/new', parentFolder?.uid),
              from: location.pathname,
            })
          }
          url={buildUrl('/dashboard/new', parentFolder?.uid)}
        />
      )}
      {canCreateFolder && <MenuItem onClick={() => setShowNewFolderDrawer(true)} label={getNewFolderPhrase()} />}
      {canCreateDashboard && (
        <MenuItem
          label={getImportPhrase()}
          onClick={() =>
            reportInteraction('grafana_menu_item_clicked', {
              url: buildUrl('/dashboard/import', parentFolder?.uid),
              from: location.pathname,
            })
          }
          url={buildUrl('/dashboard/import', parentFolder?.uid)}
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
          onClose={() => setShowNewFolderDrawer(false)}
          size="sm"
        >
          <NewFolderForm onConfirm={onCreateFolder} onCancel={() => setShowNewFolderDrawer(false)} />
        </Drawer>
      )}
    </>
  );
}

/**
 *
 * @param url without any parameters
 * @param folderUid  folder id
 * @returns url with paramter if folder is present
 */
function buildUrl(url: string, folderUid: string | undefined) {
  const baseUrl = folderUid ? url + '?folderUid=' + folderUid : url;
  return config.appSubUrl ? config.appSubUrl + baseUrl : baseUrl;
}
