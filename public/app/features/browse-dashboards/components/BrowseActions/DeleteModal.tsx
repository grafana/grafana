import React, { useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { Alert, ConfirmModal, Text, Space } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const { data } = useGetAffectedItemsQuery(selectedItems);
  const deleteIsInvalid = !config.featureToggles.nestedFolders && data && (data.alertRule || data.libraryPanel);
  const [isDeleting, setIsDeleting] = useState(false);
  const containsDashboards = data?.dashboard && data.dashboard > 0;
  const containsFolders = data?.folder && data.folder > 0;

  const description = useMemo(() => {
    if (containsDashboards) {
      if (containsFolders) {
        return 'Are you sure you want to delete this content? Folders will be permanently deleted but dashboards will be moved to trash and permanently deleted after 30 days.';
      }
      return 'Are you sure you want to delete this content? It will be moved to trash and permanently deleted after 30 days.';
    }
    return t('browse-dashboards.action.delete-modal-text', 'This action will delete the following content:');
  }, [containsDashboards, containsFolders]);

  const onDelete = async () => {
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
          <Text element="p">{description}</Text>
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
      confirmText={
        isDeleting
          ? t('browse-dashboards.action.deleting', 'Deleting...')
          : t('browse-dashboards.action.delete-button', 'Delete')
      }
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title={containsDashboards ? 'Move to trash' : t('browse-dashboards.action.delete-modal-title', 'Delete')}
      {...props}
    />
  );
};
