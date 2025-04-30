import { useState } from 'react';

import { locationService } from '@grafana/runtime';
import { Dropdown, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';

import { alertingFolderActionsApi } from '../../api/alertingFolderActionsApi';
import { FolderAction, useFolderAbility } from '../../hooks/useAbilities';
import { useFolder } from '../../hooks/useFolder';
import { createRelativeUrl } from '../../utils/url';

import { DeleteModal } from './DeleteModal';
import { FolderActionMenuItem } from './MenuItemPauseFolder';
interface Props {
  folderUID: string;
}

export const FolderBulkActionsButton = ({ folderUID }: Props) => {
  const [pauseSupported, pauseAllowed] = useFolderAbility(FolderAction.Pause);
  const canPause = pauseSupported && pauseAllowed;
  const [deleteSupported, deleteAllowed] = useFolderAbility(FolderAction.Delete);
  const canDelete = deleteSupported && deleteAllowed;
  const [pauseFolder, updateState] = alertingFolderActionsApi.endpoints.pauseFolder.useMutation();
  const [unpauseFolder, unpauseState] = alertingFolderActionsApi.endpoints.unpauseFolder.useMutation();
  const [deleteGrafanaRulesFromFolder, deleteState] =
    alertingFolderActionsApi.endpoints.deleteGrafanaRulesFromFolder.useMutation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const folderName = useFolder(folderUID).folder?.title || 'unknown folder';

  if (!canPause && !canDelete) {
    return null;
  }

  const onConfirmDelete = async () => {
    await deleteGrafanaRulesFromFolder({ namespace: folderUID }).unwrap();
    redirectToListView();
  };

  const menuItems = (
    <>
      {canPause && (
        <>
          <FolderActionMenuItem
            folderUID={folderUID}
            action="pause"
            executeAction={async (folderUID) => {
              await pauseFolder({ namespace: folderUID }).unwrap();
            }}
            isLoading={updateState.isLoading}
          />
          <FolderActionMenuItem
            folderUID={folderUID}
            action="unpause"
            executeAction={async (folderUID) => {
              await unpauseFolder({ namespace: folderUID }).unwrap();
            }}
            isLoading={unpauseState.isLoading}
          />
        </>
      )}
      {canDelete && (
        <Menu.Item
          label={t('alerting.folder-bulk-actions.delete.button.label', 'Delete folder')}
          icon="trash-alt"
          onClick={() => setIsDeleteModalOpen(true)}
          disabled={deleteState.isLoading}
        />
      )}
    </>
  );

  return (
    <>
      <Dropdown overlay={<Menu>{menuItems}</Menu>}>
        <MoreButton size="sm" title={t('alerting.folder-bulk-actions.more-button.title', 'Folder Actions')} />
      </Dropdown>
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onConfirm={onConfirmDelete}
        onDismiss={() => setIsDeleteModalOpen(false)}
        folderName={folderName}
      />
    </>
  );
};

function redirectToListView() {
  locationService.replace(createRelativeUrl('/alerting/list', { view: 'list' }, { skipSubPath: true }));
}
