import React, { useState } from 'react';

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
  const deleteIsInvalid = Boolean(data && (data.alertRule || data.libraryPanel));
  const [isDeleting, setIsDeleting] = useState(false);
  console.log('DeleteModal', { deleteIsInvalid });
  const onDelete = async () => {
    if (deleteIsInvalid) {
      return;
    } else {
      setIsDeleting(true);
      try {
        await onConfirm();
        setIsDeleting(false);
        onDismiss();
      } catch {
        setIsDeleting(false);
      }
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans i18nKey="browse-dashboards.action.delete-modal-text">
              This action will delete the following content:
            </Trans>
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
      confirmationText={deleteIsInvalid ? ' ' : 'Delete'}
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
