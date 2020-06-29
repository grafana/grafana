import React, { FC } from 'react';
import { Icon, ModalsController } from '@grafana/ui';

import { RowOptionsModal } from './RowOptionsModal';
import { OnRowOptionsUpdate } from './RowOptionsForm';

export interface RowOptionsButtonProps {
  title: string | null;
  repeat: string | null;
  onUpdate: OnRowOptionsUpdate;
}

export const RowOptionsButton: FC<RowOptionsButtonProps> = ({ repeat, title, onUpdate }) => {
  const onUpdateChange = (hideModal: () => void) => (title: string | null, repeat: string | null) => {
    onUpdate(title, repeat);
    hideModal();
  };

  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <a
            className="pointer"
            onClick={() => {
              showModal(RowOptionsModal, { title, repeat, onDismiss: hideModal, onUpdate: onUpdateChange(hideModal) });
            }}
          >
            <Icon name="cog" />
          </a>
        );
      }}
    </ModalsController>
  );
};

RowOptionsButton.displayName = 'RowOptionsButton';
