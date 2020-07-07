import React from 'react';
import { Modal } from '@grafana/ui';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { SaveDashboardModalProps } from './types';

export const SaveProvisionedDashboard: React.FC<SaveDashboardModalProps> = ({ dashboard, onDismiss }) => {
  return (
    <Modal isOpen={true} title="Cannot save provisioned dashboard" icon="copy" onDismiss={onDismiss}>
      <SaveProvisionedDashboardForm dashboard={dashboard} onCancel={onDismiss} onSuccess={onDismiss} />
    </Modal>
  );
};
