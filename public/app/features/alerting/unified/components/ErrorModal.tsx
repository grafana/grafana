import { Trans, t } from '@grafana/i18n';
import { Button, Modal, type ModalProps } from '@grafana/ui';

import { stringifyErrorLike } from '../utils/misc';

interface ErrorModalProps extends Pick<ModalProps, 'isOpen' | 'onDismiss'> {
  error: unknown;
}

export const ErrorModal = ({ isOpen, onDismiss, error }: ErrorModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onDismiss}
      closeOnBackdropClick={true}
      closeOnEscape={true}
      title={t('alerting.error-modal.title-something-went-wrong', 'Something went wrong')}
    >
      <p>
        <Trans i18nKey="alerting.error-modal.failed-to-update-your-configuration">
          Failed to update your configuration:
        </Trans>
      </p>
      <pre>
        <code>{stringifyErrorLike(error)}</code>
      </pre>
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={onDismiss}>
          {t('alerting.common.close', 'Close')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
