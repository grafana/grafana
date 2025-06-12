import React, { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, Space, Text } from '@grafana/ui';

import { trackFolderBulkActionsDeleteFail, trackFolderBulkActionsDeleteSuccess } from '../../Analytics';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  folderName: string;
}

export const DeleteModal = React.memo(({ onConfirm, onDismiss, isOpen, folderName }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const onDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      trackFolderBulkActionsDeleteSuccess();
      onDismiss();
    } catch {
      trackFolderBulkActionsDeleteFail();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans i18nKey="alerting.folder-bulk-actions.delete-modal-text" values={{ folderName: folderName }}>
              This action will delete all alert rules in the <code>{'{{folderName}}'}</code> folder. Nested folders will
              not be affected.
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
      onConfirm={onDeleteConfirm}
      title={t('alerting.folder-bulk-actions.delete-modal-title', 'Delete')}
      isOpen={isOpen}
    />
  );
});
