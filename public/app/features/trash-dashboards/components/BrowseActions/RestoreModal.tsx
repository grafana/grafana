import React from 'react';

import { Button, Modal, Text } from '@grafana/ui';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';

import { DashboardTreeSelection } from '../../../browse-dashboards/types';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
  isLoading: boolean;
}

export const RestoreModal = ({ onConfirm, onDismiss, selectedItems, isLoading, ...props }: Props) => {
  const onMove = async () => {
    await onConfirm();
    onDismiss();
  };

  return (
    <Modal title="Restore" onDismiss={onDismiss} {...props}>
      <Text element="p">This action will restore the following content:</Text>
      <DescendantCount selectedItems={selectedItems} />
      <Modal.ButtonRow>
        <Button onClick={onDismiss} variant="secondary" fill="outline">
          Cancel
        </Button>
        <Button disabled={isLoading} onClick={onMove} variant="primary">
          {isLoading ? 'Restoring...' : 'Restore'}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
