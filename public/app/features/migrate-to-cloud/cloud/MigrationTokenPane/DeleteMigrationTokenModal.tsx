import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Modal, Button, Text } from '@grafana/ui';

interface Props {
  hideModal: () => void;
  onConfirm: () => Promise<{ data: void } | { error: unknown }>;
}

export const DeleteMigrationTokenModal = ({ hideModal, onConfirm }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const onConfirmDelete = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
    hideModal();
  };

  return (
    <Modal
      isOpen
      title={t('migrate-to-cloud.migration-token.delete-modal-title', 'Delete migration token')}
      onDismiss={hideModal}
    >
      <Text color="secondary">
        <Trans i18nKey="migrate-to-cloud.migration-token.delete-modal-body">
          If you&apos;ve already used this token with a self-managed installation, that installation will no longer be
          able to upload content.
        </Trans>
      </Text>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={hideModal}>
          <Trans i18nKey="migrate-to-cloud.migration-token.delete-modal-cancel">Cancel</Trans>
        </Button>
        <Button disabled={isDeleting} variant="destructive" onClick={onConfirmDelete}>
          {isDeleting
            ? t('migrate-to-cloud.migration-token.delete-modal-deleting', 'Deleting...')
            : t('migrate-to-cloud.migration-token.delete-modal-confirm', 'Delete')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
