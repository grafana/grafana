import { useId } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Modal, Button, Input, Stack, ClipboardButton, Field } from '@grafana/ui';

import { TokenErrorAlert } from '../TokenErrorAlert';

interface Props {
  isOpen: boolean;
  hideModal: () => void;
  migrationToken?: string;
}

export const CreateTokenModal = ({ isOpen, hideModal, migrationToken }: Props) => {
  return (
    <Modal
      isOpen={isOpen}
      title={t('migrate-to-cloud.migration-token.modal-title', 'Migration token created')}
      onDismiss={hideModal}
    >
      {migrationToken ? <TokenSuccessContent migrationToken={migrationToken} /> : <TokenErrorAlert />}

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={hideModal}>
          <Trans i18nKey="migrate-to-cloud.migration-token.modal-close">Close</Trans>
        </Button>

        {migrationToken && (
          <ClipboardButton variant="primary" getText={() => migrationToken} onClipboardCopy={hideModal}>
            <Trans i18nKey="migrate-to-cloud.migration-token.modal-copy-and-close">Copy to clipboard and close</Trans>
          </ClipboardButton>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
};

function TokenSuccessContent({ migrationToken }: { migrationToken: string }) {
  const inputId = useId();

  return (
    <Field
      description={t(
        'migrate-to-cloud.migration-token.modal-field-description',
        'Copy the token now, as you will not be able to see it again. Losing this token requires creating a new one.'
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
  );
}
