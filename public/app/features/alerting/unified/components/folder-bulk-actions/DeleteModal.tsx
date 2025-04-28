import { useState } from 'react';
import React from 'react';

import { ConfirmModal, Space, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}

export const DeleteModal = React.memo(({ onConfirm, onDismiss, isOpen }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const onDelete = async () => {
    // track delete folder event
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
          <Text element="p">
            <Trans i18nKey="alerting.folder-bulk-actions.delete-modal-text">
              This action will delete all the rules in the selected folder. Nested folders will not be deleted.
            </Trans>
          </Text>
          <Space v={2} />
        </>
      }
      confirmationText={t('alerting.folder-bulk-actions.delete-modal-confirmation-text', 'Delete')}
      confirmText={
        isDeleting
          ? t('alerting.folder-bulk-actions.delete-modal-deleting', 'Deleting...')
          : t('alerting.folder-bulk-actions.delete-modal-delete-button', 'Delete')
      }
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title={t('alerting.folder-bulk-actions.delete-modal-title', 'Delete')}
      isOpen={isOpen}
    />
  );
});
