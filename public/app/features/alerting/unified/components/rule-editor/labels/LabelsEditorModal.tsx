import React from 'react';

import { Modal } from '@grafana/ui';

import { LabelsSubForm } from './LabelsField';

export interface LabelsEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSourceName: string;
}
export function LabelsEditorModal({ isOpen, onClose, dataSourceName }: LabelsEditorModalProps) {
  return (
    <Modal title="Edit labels" closeOnEscape isOpen={isOpen} onDismiss={onClose}>
      <LabelsSubForm dataSourceName={dataSourceName} onClose={onClose} />
    </Modal>
  );
}
