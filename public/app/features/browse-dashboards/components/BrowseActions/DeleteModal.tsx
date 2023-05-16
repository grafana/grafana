import React from 'react';

import { Space } from '@grafana/experimental';
import { ConfirmModal } from '@grafana/ui';
import { P } from '@grafana/ui/src/unstable';

import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const onDelete = () => {
    onConfirm();
    onDismiss();
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
      confirmText="Delete"
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title="Delete Compute Resources"
      {...props}
    />
  );
};
