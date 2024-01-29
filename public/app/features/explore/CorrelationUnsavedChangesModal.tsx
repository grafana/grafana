import { css } from '@emotion/css';
import React from 'react';

import { Button, Modal } from '@grafana/ui';

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
      title={`Unsaved changes to correlation`}
      onDismiss={onCancel}
      icon="exclamation-triangle"
      className={css({ width: '600px' })}
    >
      <h5>{message}</h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          Continue without saving
        </Button>
        <Button variant="primary" onClick={onSave}>
          Save correlation
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
