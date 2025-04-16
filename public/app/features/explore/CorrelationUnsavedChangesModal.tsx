import { css } from '@emotion/css';

import { Button, Modal } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

interface UnsavedChangesModalProps {
  message: string;
  onDiscard: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export const CorrelationUnsavedChangesModal = ({ onSave, onDiscard, onCancel, message }: UnsavedChangesModalProps) => {
  return (
    <Modal
      isOpen={true}
      title={t(
        'explore.correlation-unsaved-changes-modal.title-unsaved-changes-to-correlation',
        'Unsaved changes to correlation'
      )}
      onDismiss={onCancel}
      icon="exclamation-triangle"
      className={css({ width: '600px' })}
    >
      <h5>{message}</h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          <Trans i18nKey="explore.correlation-unsaved-changes-modal.cancel">Cancel</Trans>
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          <Trans i18nKey="explore.correlation-unsaved-changes-modal.continue-without-saving">
            Continue without saving
          </Trans>
        </Button>
        <Button variant="primary" onClick={onSave}>
          <Trans i18nKey="explore.correlation-unsaved-changes-modal.save-correlation">Save correlation</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
