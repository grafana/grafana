import React from 'react';

import { Space } from '@grafana/experimental';
import { ConfirmModal, Text } from '@grafana/ui';
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
    <ConfirmModal
      body={
        <>
          <Text element="p">This action will restore the following content:</Text>
          <DescendantCount selectedItems={selectedItems} />
          <Space v={2} />
        </>
      }
      confirmText={isLoading ? 'Restoring...' : 'Restore'}
      confirmButtonVariant="primary"
      onDismiss={onDismiss}
      onConfirm={onMove}
      title="Restore"
      {...props}
    />
  );
};
