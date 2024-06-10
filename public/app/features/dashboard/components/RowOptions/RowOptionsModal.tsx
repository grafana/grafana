import { css } from '@emotion/css';
import React from 'react';

import { Modal, useStyles2 } from '@grafana/ui';

import { OnRowOptionsUpdate, RowOptionsForm } from './RowOptionsForm';

export interface RowOptionsModalProps {
  title: string;
  repeat?: string;
  warning?: React.ReactNode;
  onDismiss: () => void;
  onUpdate: OnRowOptionsUpdate;
}

export const RowOptionsModal = ({ repeat, title, onDismiss, onUpdate, warning }: RowOptionsModalProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal isOpen={true} title="Row options" icon="copy" onDismiss={onDismiss} className={styles.modal}>
      <RowOptionsForm repeat={repeat} title={title} onCancel={onDismiss} onUpdate={onUpdate} warning={warning} />
    </Modal>
  );
};

const getStyles = () => ({
  modal: css`
    label: RowOptionsModal;
    width: 500px;
  `,
});
