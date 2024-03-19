import React from 'react';

import { PanelModel } from '@grafana/data';
import { ConfirmModal } from '@grafana/ui';

import { PanelModel as LegacyPanelModel } from '../../../dashboard/state';
import { isPanelModelLibraryPanel, isPanelModelLibraryPanel2 } from '../../guard';

export interface ChangeLibraryPanelModalProps {
  panel: LegacyPanelModel;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ChangeLibraryPanelModal = ({ onConfirm, onDismiss, panel }: ChangeLibraryPanelModalProps): JSX.Element => {
  const isLibraryPanel = isPanelModelLibraryPanel(panel);
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

// --------- dashboard scene ----------

export interface ChangeLibraryPanelModalProps2 {
  panel: PanelModel;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ChangeLibraryPanelModal2 = ({
  onConfirm,
  onDismiss,
  panel,
}: ChangeLibraryPanelModalProps2): JSX.Element => {
  const isLibraryPanel = isPanelModelLibraryPanel2(panel);
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
