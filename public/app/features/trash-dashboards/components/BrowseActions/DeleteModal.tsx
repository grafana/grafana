import React from 'react';

import { Space } from '@grafana/experimental';
import { ConfirmModal, Text } from '@grafana/ui';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';
import { DashboardTreeSelection } from 'app/features/browse-dashboards/types';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
  isLoading: boolean;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, isLoading, ...props }: Props) => {
  const onDelete = async () => {
    await onConfirm();
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">Are you sure you want to delete this content?</Text>
          <Text element="p">This action cannot be undone</Text>
          <DescendantCount selectedItems={selectedItems} />
          <Space v={2} />
        </>
      }
      confirmationText="Delete"
      confirmText={isLoading ? 'Deleting...' : 'Delete'}
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title="Delete"
      {...props}
    />
  );
};
