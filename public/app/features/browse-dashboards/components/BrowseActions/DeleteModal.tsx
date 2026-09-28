import { useState } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useFlagKubernetesFolderCascadeDeleteAsync } from '@grafana/runtime/internal';
import { ConfirmModal, Space } from '@grafana/ui';

import { type DashboardTreeSelection } from '../../types';
import { getSelectedUIDs } from '../../utils/dashboards';
import { DeletedDashboardsInfo } from '../DeletedDashboardsInfo';

import { AffectedFolderContents } from './AffectedFolderContents';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedFolders = getSelectedUIDs(selectedItems, 'folder');
  const cascadeDeleteAsyncEnabled = useFlagKubernetesFolderCascadeDeleteAsync();

  const onDelete = async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: Object.keys(selectedItems.dashboard).length,
        folder: Object.keys(selectedItems.folder).length,
      },
      source: 'browse_dashboards',
    });
    setIsDeleting(true);
    try {
      await onConfirm();
      // Any cascade this kicks off keeps running in the background from here -- see
      // FolderCascadeStatusBanner (on the folder's own page) and DeletingFolderBadge/
      // DeletingDashboardBadge (in the browse tree) for its ongoing progress, and the same banner
      // for surfacing a cascade that gets stuck. This modal doesn't wait around for any of that,
      // and deliberately doesn't navigate anywhere either -- staying put is what lets
      // FolderCascadeStatusBanner actually be seen.
      onDismiss();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <DeletedDashboardsInfo
            target="folder"
            cascadeAsync={selectedFolders.length > 0 && cascadeDeleteAsyncEnabled}
          />
          <Space v={2} />
          <AffectedFolderContents
            selectedItems={selectedItems}
            emptyMessage={t('browse-dashboards.action.delete-modal-folder-empty', '', {
              count: selectedFolders.length,
              defaultValue_one: 'Selected folder is empty',
              defaultValue_other: 'Selected folders are empty',
            })}
            nonEmptyMessage={t('browse-dashboards.action.delete-modal-folder-not-empty', '', {
              count: selectedFolders.length,
              defaultValue_one: 'Selected folder contains resources that will be deleted',
              defaultValue_other: 'Selected folders contain resources that will be deleted',
            })}
          />
          <Space v={2} />
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
      disabled={isDeleting}
    />
  );
};
