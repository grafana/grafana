import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, ConfirmModal, Space } from '@grafana/ui';
import { useGetAffectedItems } from 'app/api/clients/folder/v1beta1/hooks';

import { type DashboardTreeSelection } from '../../types';
import { DeletedDashboardsInfo } from '../DeletedDashboardsInfo';

import { getFolderIsEmpty } from './utils';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const { data, isLoading } = useGetAffectedItems(selectedItems);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedFolders = Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]);
  const folderIsEmpty = getFolderIsEmpty(data, selectedItems);

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
          <DeletedDashboardsInfo target="folder" />
          <Space v={2} />

          {!!selectedFolders?.length &&
            // Only show this if we have any folders selected. If user selected one or more specific resources, there
            // are no children that could be deleted by accident.
            (isLoading ? (
              <Skeleton width={200} />
            ) : folderIsEmpty ? (
              <Alert
                title={t('browse-dashboards.action.delete-modal-folder-empty', 'Selected folder is empty', {
                  count: selectedFolders.length,
                  defaultValue_other: 'Selected folders are empty',
                })}
                severity={'success'}
              />
            ) : (
              <Alert
                title={t(
                  'browse-dashboards.action.delete-modal-folder-not-empty',
                  'Selected folder contains other resources that will be deleted',
                  {
                    count: selectedFolders.length,
                    defaultValue_other: 'Selected folders contain other resources that will be deleted',
                  }
                )}
                severity={'warning'}
              />
            ))}
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
    />
  );
};
