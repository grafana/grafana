import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Alert, ConfirmModal, Text, Space } from '@grafana/ui';
import { useGetAffectedItems, useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';

import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const { data } = useGetAffectedItems(selectedItems);
  const deleteIsInvalid = Boolean(data && (data.alertrules || data.library_elements));
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedFolders = Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]);
  const selectedDashboards = Object.keys(selectedItems.dashboard || {}).filter((uid) => selectedItems.dashboard[uid]);
  const selectedPanels = Object.keys(selectedItems.panel || {}).filter((uid) => selectedItems.panel[uid]);
  const { data: folderData } = useGetFolderQueryFacade(selectedFolders.length === 1 ? selectedFolders[0] : undefined);

  // If we are only moving one folder, we can show a different message
  // (we might be in the "Folder actions" version of the modal)
  const onlyOneFolderSelected =
    selectedFolders.length === 1 && selectedDashboards.length === 0 && selectedPanels.length === 0;

  const onDelete = async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: Object.keys(selectedItems.dashboard).length,
        folder: Object.keys(selectedItems.folder).length,
      },
      source: 'browse_dashboards',
      restore_enabled: Boolean(config.featureToggles.restoreDashboards),
    });
    setIsDeleting(true);
    try {
      await onConfirm();
      setIsDeleting(false);
      onDismiss();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          {config.featureToggles.restoreDashboards && (
            <>
              <Text element="p">
                <Trans i18nKey="browse-dashboards.action.delete-modal-restore-dashboards-text">
                  This action will delete the selected folders immediately. Deleted dashboards will be kept in the
                  history for up to 12 months and can be restored by your organization administrator during that time.
                  The history is limited to 1000 dashboards — older ones may be removed sooner if the limit is reached.
                  Folders cannot be restored.
                </Trans>
              </Text>
              <Space v={2} />
            </>
          )}
          <Text element="p">
            {onlyOneFolderSelected ? (
              <Trans
                i18nKey="browse-dashboards.action.delete-modal-text-one-folder"
                values={{ folderName: folderData?.title }}
              >
                This action will delete the folder &quot;
                <Text variant="code" weight="bold">
                  {'{{ folderName }}'}
                </Text>
                &quot; and the following content:
              </Trans>
            ) : (
              <Trans i18nKey="browse-dashboards.action.delete-modal-text">
                This action will delete the following content:
              </Trans>
            )}
          </Text>
          <DescendantCount selectedItems={selectedItems} />
          <Space v={2} />
        </>
      }
      description={
        <>
          {deleteIsInvalid ? (
            <Alert
              severity="warning"
              title={t('browse-dashboards.action.delete-modal-invalid-title', 'Cannot delete folder')}
            >
              <Trans i18nKey="browse-dashboards.action.delete-modal-invalid-text">
                One or more folders contain library panels or alert rules. Delete these first in order to proceed.
              </Trans>
            </Alert>
          ) : null}
        </>
      }
      confirmationText={t('browse-dashboards.action.confirmation-text', 'Delete')}
      confirmText={
        isDeleting
          ? t('browse-dashboards.action.deleting', 'Deleting...')
          : t('browse-dashboards.action.delete-button', 'Delete')
      }
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title={t('browse-dashboards.action.delete-modal-title', 'Delete')}
      {...props}
      disabled={deleteIsInvalid}
    />
  );
};
