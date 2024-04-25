import React from 'react';

import { Modal } from '@grafana/ui';

import { LabelsSubForm } from './LabelsField';

export interface LabelsEditorModalProps {
  isOpen: boolean;
  initialLabels: Array<{
    key: string;
    value: string;
  }>;
  onClose: (
    labelsToUodate?: Array<{
      key: string;
      value: string;
    }>
  ) => void;
  dataSourceName: string;
}
export function LabelsEditorModal({ isOpen, onClose, dataSourceName, initialLabels }: LabelsEditorModalProps) {
  return (
    <Modal title="Edit labels" closeOnEscape isOpen={isOpen} onDismiss={() => onClose()}>
      <LabelsSubForm dataSourceName={dataSourceName} onClose={onClose} initialLabels={initialLabels} />
    </Modal>
  );
}
