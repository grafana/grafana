import { useState } from 'react';

import { useTranslate } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { alertingFolderActionsApi } from '../../api/alertingFolderActionsApi';
import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { FolderBulkAction, useFolderBulkActionAbility } from '../../hooks/useAbilities';
import { useFolder } from '../../hooks/useFolder';
import { fetchAllPromAndRulerRulesAction, fetchAllPromRulesAction, fetchRulerRulesAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeFolderLink } from '../../utils/misc';
import { createRelativeUrl } from '../../utils/url';

import { DeleteModal } from './DeleteModal';
import { PauseUnpauseActionMenuItem } from './PauseUnpauseActionMenuItem';
interface Props {
  folderUID: string;
}

export const FolderBulkActionsButton = ({ folderUID }: Props) => {
  const { t } = useTranslate();

  // state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // abilities
  const [pauseSupported, pauseAllowed] = useFolderBulkActionAbility(FolderBulkAction.Pause);
  const [deleteSupported, deleteAllowed] = useFolderBulkActionAbility(FolderBulkAction.Delete);

  const canPause = pauseSupported && pauseAllowed;
  const canDelete = deleteSupported && deleteAllowed;

  // mutations
  const [pauseFolder, updateState] = alertingFolderActionsApi.endpoints.pauseFolder.useMutation();
  const [unpauseFolder, unpauseState] = alertingFolderActionsApi.endpoints.unpauseFolder.useMutation();
  const [deleteGrafanaRulesFromFolder, deleteState] =
    alertingFolderActionsApi.endpoints.deleteGrafanaRulesFromFolder.useMutation();

  const folderName = useFolder(folderUID).folder?.title || 'unknown folder';
  const listView2Enabled = config.featureToggles.alertingListViewV2 ?? false;
  const viewComponent = listView2Enabled ? 'list' : 'grouped';

  // URLs
  const redirectToListView = useRedirectToListView(viewComponent);
  const folderBaseUrl = makeFolderLink(folderUID);

  if (!canPause && !canDelete) {
    return null;
  }

  const onConfirmDelete = async () => {
    await deleteGrafanaRulesFromFolder({ namespace: folderUID }).unwrap();
    await redirectToListView();
  };

  const menuItems = (
    <>
      {/* for the v2 list we'll add the regular folder actions here too */}
      {listView2Enabled && (
        <>
          <Menu.Item
            label={t('alerting.folder-bulk-actions.view.folder', 'View folder')}
            icon="folder-open"
            url={folderBaseUrl}
          />
          {/* TODO implement this, but needs access to a FolderDTO :( */}
          {/* <Menu.Item label={t('alerting.folder-bulk-actions.export.rules', 'Export rules')} icon="download-alt" /> */}
          <Menu.Divider />
        </>
      )}
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
          label={t('alerting.folder-bulk-actions.delete.button.label', 'Delete all rules')}
          icon="trash-alt"
          onClick={() => setIsDeleteModalOpen(true)}
          disabled={deleteState.isLoading}
        />
      )}
    </>
  );

  return (
    <>
      <Dropdown placement="bottom" overlay={<Menu>{menuItems}</Menu>}>
        <IconButton
          name="ellipsis-h"
          size="sm"
          aria-label={t('alerting.folder-bulk-actions.more-button.title', 'Folder actions')}
          tooltip={t('alerting.folder-bulk-actions.more-button.tooltip', 'Folder actions')}
          tooltipPlacement="top"
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
