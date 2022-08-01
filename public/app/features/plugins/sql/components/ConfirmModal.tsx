import React, { useRef, useEffect } from 'react';

import { Button, Icon, Modal } from '@grafana/ui';

type ConfirmModalProps = {
  isOpen: boolean;
  onCancel?: () => void;
  onDiscard?: () => void;
  onCopy?: () => void;
};
export function ConfirmModal({ isOpen, onCancel, onDiscard, onCopy }: ConfirmModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Moved from grafana/ui
  useEffect(() => {
    // for some reason autoFocus property did no work on this button, but this does
    if (isOpen) {
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <Modal
      title={
        <div className="modal-header-title">
          <Icon name="exclamation-triangle" size="lg" />
          <span className="p-l-1">Warning</span>
        </div>
      }
      onDismiss={onCancel}
      isOpen={isOpen}
    >
      <p>
        Builder mode does not display changes made in code. The query builder will display the last changes you made in
        builder mode.
      </p>
      <p>Do you want to copy your code to the clipboard?</p>
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" type="button" onClick={onDiscard} ref={buttonRef}>
          Discard code and switch
        </Button>
        <Button variant="primary" onClick={onCopy}>
          Copy code and switch
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
