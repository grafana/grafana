import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { RepoType } from 'app/features/provisioning/Wizard/types';
import { NewProvisionedFolderForm } from 'app/features/provisioning/components/NewProvisionedFolderForm';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/repository';
import {
  getImportPhrase,
  getNewDashboardPhrase,
  getNewFolderPhrase,
  getNewPhrase,
} from 'app/features/search/tempI18nPhrases';
import { FolderDTO } from 'app/types/folders';

import { ManagerKind } from '../../apiserver/types';
import { useNewFolderMutation } from '../api/browseDashboardsAPI';

import { NewFolderForm } from './NewFolderForm';

interface Props {
  parentFolder?: FolderDTO;
  canCreateFolder: boolean;
  canCreateDashboard: boolean;
  isReadOnlyRepo: boolean;
  repoType?: RepoType;
}

export default function CreateNewButton({
  parentFolder,
  canCreateDashboard,
  canCreateFolder,
  isReadOnlyRepo,
  repoType,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [newFolder] = useNewFolderMutation();
  const [showNewFolderDrawer, setShowNewFolderDrawer] = useState(false);
  const notifyApp = useAppNotification();
  const isProvisionedInstance = useIsProvisionedInstance();

  const onCreateFolder = async (folderName: string) => {
    try {
      const folder = await newFolder({
        title: folderName,
        parentUid: parentFolder?.uid,
      });

      const depth = parentFolder ? (parentFolder.parents?.length || 0) + 1 : 0;
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
        <Button
          disabled={isReadOnlyRepo}
          tooltip={isReadOnlyRepo ? getReadOnlyTooltipText({ isLocal: repoType === 'local' }) : undefined}
          variant="secondary"
        >
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
          {parentFolder?.managedBy === ManagerKind.Repo || isProvisionedInstance ? (
            <NewProvisionedFolderForm onDismiss={() => setShowNewFolderDrawer(false)} parentFolder={parentFolder} />
          ) : (
            <NewFolderForm onConfirm={onCreateFolder} onCancel={() => setShowNewFolderDrawer(false)} />
          )}
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
