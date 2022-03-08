import React, { useEffect } from 'react';
import { Modal } from '@grafana/ui';
import { reportExperimentView } from '@grafana/runtime';
import { UpgradeBox } from './UpgradeBox';

export interface Props {
  title: string;
  text: string;
  isOpen?: boolean;
  onDismiss?: () => void;
  experimentId?: string;
}

export const UpgradeModal = ({ title, text, isOpen, onDismiss, experimentId }: Props) => {
  useEffect(() => {
    if (experimentId) {
      reportExperimentView(experimentId, 'test', '');
    }
  }, [experimentId]);

  return (
    <Modal title={title} isOpen={isOpen} onDismiss={onDismiss}>
      <UpgradeBox text={text} />
    </Modal>
  );
};
