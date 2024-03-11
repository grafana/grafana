import React, { useState } from 'react';

import { Modal, Button, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

interface Props {
  hideModal: () => void;
  onConfirm: () => Promise<{ data: void } | { error: unknown }>;
}

export const DisconnectModal = ({ hideModal, onConfirm }: Props) => {
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const onConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    await onConfirm();
    setIsDisconnecting(false);
    hideModal();
  };

  return (
    <Modal
      isOpen
      title={t('migrate-to-cloud.disconnect-modal.title', 'Disconnect from cloud stack')}
      onDismiss={hideModal}
    >
      <Text color="secondary">
        <Trans i18nKey="migrate-to-cloud.disconnect-modal.body">
          This will remove the migration token from this installation. If you wish to upload more resources in the
          future, you will need to enter a new migration token.
        </Trans>
      </Text>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={hideModal}>
          <Trans i18nKey="migrate-to-cloud.disconnect-modal.cancel">Cancel</Trans>
        </Button>
        <Button disabled={isDisconnecting} onClick={onConfirmDisconnect}>
          {isDisconnecting
            ? t('migrate-to-cloud.disconnect-modal.disconnecting', 'Disconnecting...')
            : t('migrate-to-cloud.disconnect-modal.disconnect', 'Disconnect')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
