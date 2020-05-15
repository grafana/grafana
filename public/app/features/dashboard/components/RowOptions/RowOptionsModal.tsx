import React, { FC } from 'react';
import { Modal } from '@grafana/ui';
import { css } from 'emotion';

import { RowOptionsForm } from './RowOptionsForm';

export interface RowOptionsModalProps {
  title: string | null;
  repeat: string | null;
  onDismiss: () => void;
  onUpdate: (title: string | null, repeat: string | null) => void;
}

export const RowOptionsModal: FC<RowOptionsModalProps> = ({ repeat, title, onDismiss, onUpdate }) => {
  return (
    <Modal
      isOpen={true}
      title="Row Options"
      icon="copy"
      onDismiss={onDismiss}
      className={css`
        width: 500px;
      `}
    >
      <RowOptionsForm repeat={repeat} title={title} onCancel={onDismiss} onUpdate={onUpdate} />
    </Modal>
  );
};
