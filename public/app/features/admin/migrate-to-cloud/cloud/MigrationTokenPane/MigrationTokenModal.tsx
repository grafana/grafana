import React, { useId } from 'react';

import { Modal, Button, Input, Stack, ClipboardButton, Field } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

interface Props {
  hideModal: () => void;
  migrationToken: string;
}

export const MigrationTokenModal = ({ hideModal, migrationToken }: Props) => {
  const inputId = useId();

  return (
    <Modal
      isOpen
      title={t('migrate-to-cloud.migration-token.modal-title', 'Migration token created')}
      onDismiss={hideModal}
    >
      <Field
        description={t(
          'migrate-to-cloud.migration-token.modal-field-description',
          'Copy the token now as you will not be able to see it again. Losing a token requires creating a new one.'
        )}
        htmlFor={inputId}
        label={t('migrate-to-cloud.migration-token.modal-field-label', 'Token')}
      >
        <Stack>
          <Input id={inputId} value={migrationToken} readOnly />
          <ClipboardButton icon="clipboard-alt" getText={() => migrationToken}>
            <Trans i18nKey="migrate-to-cloud.migration-token.modal-copy-button">Copy to clipboard</Trans>
          </ClipboardButton>
        </Stack>
      </Field>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={hideModal}>
          <Trans i18nKey="migrate-to-cloud.migration-token.modal-close">Close</Trans>
        </Button>
        <ClipboardButton variant="primary" getText={() => migrationToken} onClipboardCopy={hideModal}>
          <Trans i18nKey="migrate-to-cloud.migration-token.modal-copy-and-close">Copy to clipboard and close</Trans>
        </ClipboardButton>
      </Modal.ButtonRow>
    </Modal>
  );
};
