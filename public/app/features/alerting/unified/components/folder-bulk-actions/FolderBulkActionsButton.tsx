import { useState } from 'react';

import { config, locationService } from '@grafana/runtime';
import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useDispatch } from 'app/types';

import { alertingFolderActionsApi } from '../../api/alertingFolderActionsApi';
import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { FolderBulkAction, useFolderBulkActionAbility } from '../../hooks/useAbilities';
import { useFolder } from '../../hooks/useFolder';
import { fetchAllPromAndRulerRulesAction, fetchAllPromRulesAction, fetchRulerRulesAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { createRelativeUrl } from '../../utils/url';

import { DeleteModal } from './DeleteModal';
import { PauseUnpauseActionMenuItem } from './PauseUnpauseActionMenuItem';
interface Props {
  folderUID: string;
}

export const FolderBulkActionsButton = ({ folderUID }: Props) => {
  const [pauseSupported, pauseAllowed] = useFolderBulkActionAbility(FolderBulkAction.Pause);
  const canPause = pauseSupported && pauseAllowed && false; // lets disable pause for now
  const [deleteSupported, deleteAllowed] = useFolderBulkActionAbility(FolderBulkAction.Delete);
  const canDelete = deleteSupported && deleteAllowed;
  const [pauseFolder, updateState] = alertingFolderActionsApi.endpoints.pauseFolder.useMutation();
  const [unpauseFolder, unpauseState] = alertingFolderActionsApi.endpoints.unpauseFolder.useMutation();
  const [deleteGrafanaRulesFromFolder, deleteState] =
    alertingFolderActionsApi.endpoints.deleteGrafanaRulesFromFolder.useMutation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const folderName = useFolder(folderUID).folder?.title || 'unknown folder';
  const listView2Enabled = config.featureToggles.alertingListViewV2 ?? false;
  const view = listView2Enabled ? 'list' : 'grouped';
  const redirectToListView = useRedirectToListView(view);

  if (!canPause && !canDelete) {
    return null;
  }

  const onConfirmDelete = async () => {
    await deleteGrafanaRulesFromFolder({ namespace: folderUID }).unwrap();
    await redirectToListView();
  };

  const menuItems = (
    <>
      {canPause && (
        <>
          <PauseUnpauseActionMenuItem
            folderUID={folderUID}
            action="pause"
            executeAction={async (folderUID) => {
              await pauseFolder({ namespace: folderUID }).unwrap();
              await redirectToListView();
            }}
            isLoading={updateState.isLoading}
          />
          <PauseUnpauseActionMenuItem
            folderUID={folderUID}
            action="unpause"
            executeAction={async (folderUID) => {
              await unpauseFolder({ namespace: folderUID }).unwrap();
              await redirectToListView();
            }}
            isLoading={unpauseState.isLoading}
          />
        </>
      )}
      {canDelete && (
        <Menu.Item
          label={t('alerting.folder-bulk-actions.delete.button.label', 'Delete rules')}
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
        <IconButton
          name="ellipsis-v"
          size="sm"
          aria-label={t('alerting.folder-bulk-actions.more-button.title', 'Folder bulk Actions')}
          tooltip={t('alerting.folder-bulk-actions.more-button.tooltip', 'Folder bulk Actions')}
        />
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

function useRedirectToListView(view: string) {
  const dispatch = useDispatch();
  const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();
  const redirectToListView = async () => {
    if (prometheusRulesPrimary) {
      await dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
      await dispatch(fetchAllPromRulesAction(false));
    } else {
      await dispatch(fetchAllPromAndRulerRulesAction(false));
    }
    locationService.push(createRelativeUrl('/alerting/list', { view }, { skipSubPath: true }));
  };

  return redirectToListView;
}
