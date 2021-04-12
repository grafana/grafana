import React from 'react';
import { Button, HorizontalGroup, Modal } from '@grafana/ui';

import { PanelModel } from '../../../dashboard/state';

export interface ChangeLibraryPanelModalProps {
  panel: PanelModel;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ChangeLibraryPanelModal = ({ onConfirm, onDismiss, panel }: ChangeLibraryPanelModalProps): JSX.Element => {
  const title = `${Boolean(panel.libraryPanel) ? 'Changing' : 'Change to'} library panel`;
  const description = `Changing ${
    Boolean(panel.libraryPanel) ? '' : 'to'
  } library panel will remove any changes since last save.`;
  return (
    <Modal title={title} onDismiss={onDismiss} isOpen={true}>
      <div>
        <p> {description} </p>
        <HorizontalGroup>
          <Button variant="destructive" onClick={onConfirm}>
            Change
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Cancel
          </Button>
        </HorizontalGroup>
      </div>
    </Modal>
  );
};
