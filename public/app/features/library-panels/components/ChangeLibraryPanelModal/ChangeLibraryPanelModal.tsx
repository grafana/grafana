import React from 'react';
import { ConfirmModal } from '@grafana/ui';

import { PanelModel } from '../../../dashboard/state';

export interface ChangeLibraryPanelModalProps {
  panel: PanelModel;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ChangeLibraryPanelModal = ({ onConfirm, onDismiss, panel }: ChangeLibraryPanelModalProps): JSX.Element => {
  const isLibraryPanel = Boolean(panel.libraryPanel);
  const title = `${isLibraryPanel ? 'Changing' : 'Change to'} library panel`;
  const body = `Changing ${isLibraryPanel ? '' : 'to a'} library panel will remove any changes since last save.`;
  return (
    <ConfirmModal
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      confirmText="Change"
      title={title}
      body={body}
      dismissText="Cancel"
      isOpen={true}
    />
  );
};
