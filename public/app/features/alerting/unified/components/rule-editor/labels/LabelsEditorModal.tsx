import React from 'react';

import { Modal, Space, Stack } from '@grafana/ui';

import { LabelsInRule, LabelsWithSuggestions } from './LabelsField';

export interface LabelsEditorModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  dataSourceName: string;
}
export function LabelsEditorModal({ isOpen, onDismiss, dataSourceName }: LabelsEditorModalProps) {
  return (
    <Modal title="Edit labels" closeOnEscape isOpen={isOpen} onDismiss={onDismiss}>
      <Stack direction="column" gap={1} alignItems="center">
        <LabelsInRule />
        <Space v={0.5} />
        <LabelsWithSuggestions dataSourceName={dataSourceName} />
      </Stack>
    </Modal>
  );
}
