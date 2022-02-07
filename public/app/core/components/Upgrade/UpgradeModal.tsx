import React from 'react';
import { Modal } from '@grafana/ui';
import { UpgradeBox } from './UpgradeBox';

export interface Props {
  title: string;
  text: string;
  isOpen?: boolean;
  onDismiss?: () => void;
}

export const UpgradeModal = ({ title, text, isOpen, onDismiss }: Props) => {
  return (
    <Modal title={title} isOpen={isOpen} onDismiss={onDismiss}>
      <UpgradeBox text={text} />
    </Modal>
  );
};
