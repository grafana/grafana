import React, { useCallback } from 'react';

import { Alert, ConfirmModal, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useDisconnectStackMutation } from '../api';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
}

export const DisconnectModal = ({ isOpen, onDismiss }: Props) => {
  const [disconnectStack, { isLoading, isError }] = useDisconnectStackMutation();

  const handleConfirm = useCallback(async () => {
    const resp = await disconnectStack();
    if (!('error' in resp)) {
      onDismiss();
    }
  }, [disconnectStack, onDismiss]);

  const confirmBody = (
    <Stack direction="column">
      {isError && (
        <Alert
          severity="error"
          title={t('migrate-to-cloud.disconnect-modal.error', 'There was an error disconnecting')}
        />
      )}
      <div>
        <Trans i18nKey="migrate-to-cloud.disconnect-modal.body">
          This will remove the migration token from this installation. If you wish to upload more resources in the
          future, you will need to enter a new migration token.
        </Trans>
      </div>
    </Stack>
  );

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('migrate-to-cloud.disconnect-modal.title', 'Disconnect from cloud stack')}
      body={<></>} // body is mandatory prop, but i don't wanna
      description={confirmBody}
      confirmText={
        isLoading
          ? t('migrate-to-cloud.disconnect-modal.disconnecting', 'Disconnecting...')
          : t('migrate-to-cloud.disconnect-modal.disconnect', 'Disconnect')
      }
      dismissText={t('migrate-to-cloud.disconnect-modal.cancel', 'Cancel')}
      onConfirm={handleConfirm}
      onDismiss={onDismiss}
    />
  );
};
