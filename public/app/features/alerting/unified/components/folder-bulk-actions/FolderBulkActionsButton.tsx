import { useState } from 'react';

import { Dropdown, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';

import { alertingFolderActionsApi } from '../../api/alertingFolderActionsApi';
import { FolderAction, useFolderAbility } from '../../hooks/useAbilities';

import { DeleteModal } from './DeleteModal';
import { FolderActionMenuItem } from './MenuItemPauseFolder';
interface Props {
  folderUID: string;
}

export const FolderBukActionsButton = ({ folderUID }: Props) => {
  const [pauseSupported, pauseAllowed] = useFolderAbility(FolderAction.Pause);
  const canPause = pauseSupported && pauseAllowed;
  const [pauseFolder, updateState] = alertingFolderActionsApi.endpoints.pauseFolder.useMutation();
  const [unpauseFolder, unpauseState] = alertingFolderActionsApi.endpoints.unpauseFolder.useMutation();
  const [deleteGrafanaRulesFromFolder, deleteState] =
    alertingFolderActionsApi.endpoints.deleteGrafanaRulesFromFolder.useMutation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const onDelete = async () => {
    await deleteGrafanaRulesFromFolder({ namespace: folderUID }).unwrap();
  };

  const menuItems = (
    <>
      {canPause && (
        <>
          <FolderActionMenuItem
            folderUID={folderUID}
            label={t('alerting.folder-bulk-actions.pause.button.label', 'Pause evaluation')}
            icon="pause"
            executeAction={async (folderUID) => {
              await pauseFolder({ folderUID }).unwrap();
            }}
            isLoading={updateState.isLoading}
          />
          <FolderActionMenuItem
            folderUID={folderUID}
            label={t('alerting.folder-bulk-actions.pause.button.label', 'Unpause evaluation')}
            icon="play"
            executeAction={async (folderUID) => {
              await unpauseFolder({ folderUID }).unwrap();
            }}
            isLoading={unpauseState.isLoading}
          />
          <Menu.Item
            label={t('alerting.folder-bulk-actions.delete.button.label', 'Delete folder')}
            icon="trash-alt"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={deleteState.isLoading}
          />
        </>
      )}
    </>
  );

  return (
    <>
      <Dropdown overlay={<Menu>{menuItems}</Menu>}>
        <MoreButton size="sm" title={t('alerting.folder-bulk-actions.more-button.title', 'Folder Actions')} />
      </Dropdown>
      <DeleteModal isOpen={isDeleteModalOpen} onConfirm={onDelete} onDismiss={() => setIsDeleteModalOpen(false)} />
    </>
  );
};
