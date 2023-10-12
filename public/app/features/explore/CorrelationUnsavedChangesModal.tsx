import { css } from '@emotion/css';
import React from 'react';

import { Button, Modal } from '@grafana/ui';
import { CORRELATION_EDITOR_POST_CONFIRM_ACTION } from 'app/types';

interface UnsavedChangesModalProps {
  dirtyCorrelation: boolean;
  dirtyQueryEditor: boolean;
  action?: CORRELATION_EDITOR_POST_CONFIRM_ACTION;
  onDiscard: () => void;
  onCancel: () => void;
  onSave: () => void;
}

// this modal shows in two situations
// we are closing a pane and either the query or correlation data is dirty or
// we are changing the datasource and the datasource query is dirty

export const CorrelationUnsavedChangesModal = ({
  onSave,
  onDiscard,
  onCancel,
  dirtyCorrelation,
  dirtyQueryEditor,
  action,
}: UnsavedChangesModalProps) => {
  let message = '';
  let discardButtonLabel = 'Discard';

  if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE && dirtyQueryEditor) {
    message =
      'Changing the datasource may cause query data to be lost. Do you want to save the correlation before continuing?';
    discardButtonLabel = 'Change datasource';
  } else if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE) {
    message = `Closing the pane will cause ${dirtyCorrelation ? 'correlation' : ''}${
      dirtyCorrelation && dirtyQueryEditor ? ' and ' : ''
    }${dirtyQueryEditor ? 'query editor' : ''} data to be lost. Save the correlation?`;
  }

  return (
    <Modal
      isOpen={true}
      title={`Unsaved changes to correlation`}
      onDismiss={onCancel}
      icon="exclamation-triangle"
      className={css({ width: '500px' })}
    >
      <h5>{message}</h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          {discardButtonLabel}
        </Button>
        <Button variant="primary" onClick={onSave}>
          Save
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
