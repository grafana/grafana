import React from 'react';
import { ConfirmModal } from '@grafana/ui';
import { useDashboardRestore } from './useDashboardRestore';
export interface RevertDashboardModalProps {
  hideModal: () => void;
  version: number;
}

export const RevertDashboardModal: React.FC<RevertDashboardModalProps> = ({ hideModal, version }) => {
  // TODO: how should state.error be handled?
  const { onRestoreDashboard } = useDashboardRestore(version);

  return (
    <ConfirmModal
      isOpen={true}
      title="Restore Version"
      icon="history"
      onDismiss={hideModal}
      onConfirm={onRestoreDashboard}
      body={
        <p>Are you sure you want to restore the dashboard to version {version}? All unsaved changes will be lost.</p>
      }
      confirmText={`Yes, restore to version ${version}`}
    />
  );
};
