import React from 'react';
import { Modal } from '@grafana/ui';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { SaveDashboardModalProps } from './types';

export const SaveProvisionedDashboard: React.FC<SaveDashboardModalProps> = ({ dashboard, onClose }) => {
  return (
    <Modal isOpen={true} title="Cannot save provisioned dashboard" icon="copy" onDismiss={onClose}>
      <SaveProvisionedDashboardForm dashboard={dashboard} onCancel={onClose} onSuccess={onClose} />
    </Modal>
  );
};
