import React from 'react';
import { css } from '@emotion/css';
import { Modal, useStyles2 } from '@grafana/ui';
import { UpgradeBox } from './UpgradeBox';

export interface Props {
  text: string;
  isOpen?: boolean;
  onDismiss?: () => void;
}

export const UpgradeModal = ({ text, isOpen, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal title="" isOpen={isOpen} onDismiss={onDismiss} hideTitle={true} contentClassName={styles.content}>
      <UpgradeBox text={text} onDismiss={onDismiss} />
    </Modal>
  );
};

const getStyles = () => {
  return {
    content: css`
      padding: 0;
    `,
  };
};
