import React from 'react';

import { Icon, ModalsController } from '@grafana/ui';

import { OnRowOptionsUpdate } from './RowOptionsForm';
import { RowOptionsModal } from './RowOptionsModal';

export interface RowOptionsButtonProps {
  title: string;
  repeat?: string | null;
  onUpdate: OnRowOptionsUpdate;
}

export const RowOptionsButton = ({ repeat, title, onUpdate }: RowOptionsButtonProps) => {
  const onUpdateChange = (hideModal: () => void) => (title: string, repeat?: string | null) => {
    onUpdate(title, repeat);
    hideModal();
  };

  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <button
            type="button"
            className="pointer"
            aria-label="Row options"
            onClick={() => {
              showModal(RowOptionsModal, { title, repeat, onDismiss: hideModal, onUpdate: onUpdateChange(hideModal) });
            }}
          >
            <Icon name="cog" />
          </button>
        );
      }}
    </ModalsController>
  );
};

RowOptionsButton.displayName = 'RowOptionsButton';
