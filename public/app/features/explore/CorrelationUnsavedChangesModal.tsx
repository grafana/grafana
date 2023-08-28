import { css } from '@emotion/css';
import React from 'react';

import { Button, Modal } from '@grafana/ui';

interface UnsavedChangesModalProps {
  onDiscard: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export const CorrelationUnsavedChangesModal = ({
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) => {
  return (
    <Modal
      isOpen={true}
      title="Unsaved changes to correlation"
      onDismiss={onCancel}
      icon="exclamation-triangle"
      className={css`
        width: 500px;
      `}
    >
      <h5>Do you want to save changes to this Correlation?</h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          Discard correlation
        </Button>
        <Button variant="primary" onClick={onSave}>
          Save correlation
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
