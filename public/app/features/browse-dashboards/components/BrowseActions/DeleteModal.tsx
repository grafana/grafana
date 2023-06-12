import React, { useState } from 'react';

import { Space } from '@grafana/experimental';
import { ConfirmModal } from '@grafana/ui';
import { P } from '@grafana/ui/src/unstable';

import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const onDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      setIsDeleting(false);
      onDismiss();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <P>This action will delete the following content:</P>
          <DescendantCount selectedItems={selectedItems} />
          <Space v={2} />
        </>
      }
      confirmationText="Delete"
      confirmText={isDeleting ? 'Deleting...' : 'Delete'}
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title="Delete"
      {...props}
    />
  );
};
