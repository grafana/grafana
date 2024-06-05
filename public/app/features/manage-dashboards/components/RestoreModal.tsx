import React from 'react';

import { ConfirmModal, Text, Space } from '@grafana/ui';

import { DescendantCount } from '../../browse-dashboards/components/BrowseActions/DescendantCount';
import { DashboardTreeSelection } from '../../browse-dashboards/types';

interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
  isLoading: boolean;
}

export const RestoreModal = ({ onConfirm, onDismiss, selectedItems, isLoading, ...props }: Props) => {
  const onRestore = async () => {
    await onConfirm();
    onDismiss();
  };
  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">This action will restore the following content:</Text> {/*TODO: add Trans tag*/}
          <DescendantCount selectedItems={selectedItems} />
          <Space v={2} /> {/*TODO: does this space look good?*/}
        </>
      }
      confirmText={isLoading ? 'Restoring...' : 'Restore'} // TODO: add t for translation
      confirmButtonVariant="primary"
      onDismiss={onDismiss}
      onConfirm={onRestore}
      title="Restore"
      {...props}
    />
  );
};
