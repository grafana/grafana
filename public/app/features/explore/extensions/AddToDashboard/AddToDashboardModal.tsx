import React from 'react';

import { Modal } from '@grafana/ui';
import { ExploreId } from 'app/types';

import { AddToDashboardBody } from './AddToDashboardBody';

interface Props {
  onClose: () => void;
  exploreId: ExploreId;
}

export const AddToDashboardModal = ({ onClose, exploreId }: Props) => {
  return (
    <Modal title="Add panel to dashboard" onDismiss={onClose} isOpen>
      <AddToDashboardBody onClose={onClose} exploreId={exploreId} />
    </Modal>
  );
};
