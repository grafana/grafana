import { useState } from 'react';

import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Dropdown, Menu } from '@grafana/ui';
import { useDispatch } from 'app/types/store';

import { alertingFolderActionsApi } from '../../api/alertingFolderActionsApi';
import { shouldUseAlertingListViewV2, shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import {
  AlertingAction,
  FolderBulkAction,
  useAlertingAbility,
  useFolderBulkActionAbility,
} from '../../hooks/useAbilities';
import { useFolder } from '../../hooks/useFolder';
import { fetchAllPromAndRulerRulesAction, fetchAllPromRulesAction, fetchRulerRulesAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeFolderLink } from '../../utils/misc';
import { createRelativeUrl } from '../../utils/url';
import MoreButton from '../MoreButton';
import { GrafanaRuleFolderExporter } from '../export/GrafanaRuleFolderExporter';

import { DeleteModal } from './DeleteModal';
import { PauseUnpauseActionMenuItem } from './PauseUnpauseActionMenuItem';
interface Props {
  folderUID: string;
}

export const FolderActionsButton = ({ folderUID }: Props) => {
  // state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // feature toggles
  const bulkActionsEnabled = config.featureToggles.alertingBulkActionsInUI;
  const listView2Enabled = shouldUseAlertingListViewV2();

  const [exportRulesSupported, exportRulesAllowed] = useAlertingAbility(AlertingAction.ExportGrafanaManagedRules);

  const canExportRules = exportRulesSupported && exportRulesAllowed;

  const [deleteGrafanaRulesFromFolder, deleteState] =
    alertingFolderActionsApi.endpoints.deleteGrafanaRulesFromFolder.useMutation();

  const { folder } = useFolder(folderUID);
  const folderName = folder?.title || 'unknown folder';
  const folderUrl = makeFolderLink(folderUID);
  const viewComponent = listView2Enabled ? 'list' : 'grouped';

  // URLs
  const redirectToListView = useRedirectToListView(viewComponent);

  if (!folder) {
    return null;
  }

  const onConfirmDelete = async () => {
    await deleteGrafanaRulesFromFolder({ namespace: folderUID }).unwrap();
    await redirectToListView();
  };

  const menuItems = (
    <>
      <Menu.Item
        url={folderUrl}
        icon="eye"
        aria-label={t('alerting.list-view.folder-actions.view.aria-label', 'View folder')}
        label={t('alerting.list-view.folder-actions.view.label', 'View folder')}
      />
      <BulkActions folderUID={folderUID} onClickDelete={setIsDeleteModalOpen} isLoading={deleteState.isLoading} />
      {canExportRules && (
        <>
          {bulkActionsEnabled && <Menu.Divider />}
          <ExportFolderButton onClickExport={() => setIsExporting(true)} />
        </>
      )}
    </>
  );

  return (
    <>
      <Dropdown placement="bottom" overlay={<Menu>{menuItems}</Menu>}>
        <MoreButton
          fill="text"
          size="sm"
          aria-label={t('alerting.list-view.folder-actions.button.aria-label', 'Folder actions')}
          title={t('alerting.list-view.folder-actions.button.title', 'Actions')}
        />
      </Dropdown>
      {isExporting && <GrafanaRuleFolderExporter folder={folder} onClose={() => setIsExporting(false)} />}
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

function ExportFolderButton({ onClickExport }: { onClickExport: () => void }) {
  return (
    <Menu.Item
      aria-label={t('alerting.list-view.folder-actions.export.aria-label', 'Export rules folder')}
      data-testid="export-folder"
      key="export-folder"
      label={t('alerting.list-view.folder-actions.export.label', 'Export rules folder')}
      icon="download-alt"
      onClick={onClickExport}
    />
  );
}

function BulkActions({
  folderUID,
  onClickDelete,
  isLoading,
}: {
  folderUID: string;
  onClickDelete: (showModal: boolean) => void;
  isLoading: boolean;
}) {
  // feature toggles
  const listView2Enabled = shouldUseAlertingListViewV2();
  const bulkActionsEnabled = config.featureToggles.alertingBulkActionsInUI;

  // abilities
  const [pauseSupported, pauseAllowed] = useFolderBulkActionAbility(FolderBulkAction.Pause);
  const [deleteSupported, deleteAllowed] = useFolderBulkActionAbility(FolderBulkAction.Delete);

  const canPause = pauseSupported && pauseAllowed;
  const canDelete = deleteSupported && deleteAllowed;

  // mutations
  const [pauseFolder, updateState] = alertingFolderActionsApi.endpoints.pauseFolder.useMutation();
  const [unpauseFolder, unpauseState] = alertingFolderActionsApi.endpoints.unpauseFolder.useMutation();

  // URLs
  const viewComponent = listView2Enabled ? 'list' : 'grouped';
  const redirectToListView = useRedirectToListView(viewComponent);

  if (!bulkActionsEnabled) {
    return null;
  }

  if (!canPause && !canDelete) {
    return null;
  }

  return (
    <>
      <Menu.Divider />
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
          onClick={() => onClickDelete(true)}
          disabled={isLoading}
        />
      )}
    </>
  );
}
