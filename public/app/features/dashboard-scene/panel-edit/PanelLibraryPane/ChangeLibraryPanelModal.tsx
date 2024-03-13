import React from 'react';

import { VizPanel } from '@grafana/scenes';
import { ConfirmModal } from '@grafana/ui';

import { LibraryVizPanel } from '../../scene/LibraryVizPanel';

export interface ChangeLibraryPanelModalProps {
  panel: VizPanel;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ChangeLibraryPanelModal = ({ onConfirm, onDismiss, panel }: ChangeLibraryPanelModalProps): JSX.Element => {
  const isLibraryPanel = panel.parent instanceof LibraryVizPanel;
  const title = `${isLibraryPanel ? 'Changing' : 'Replace with'} library panel`;
  const body = `${
    isLibraryPanel ? 'Changing' : 'Replacing with a'
  } library panel will remove any changes since last save.`;
  return (
    <ConfirmModal
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      confirmText={isLibraryPanel ? 'Change' : 'Replace'}
      title={title}
      body={body}
      dismissText="Cancel"
      isOpen={true}
    />
  );
};
