import { useEffect } from 'react';

import { ConfirmModal } from '@grafana/ui';

import { useDashboardRestore } from './useDashboardRestore';
export interface RevertDashboardModalProps {
  hideModal: () => void;
  id: number;
  version: number;
}

export const RevertDashboardModal = ({ hideModal, id, version }: RevertDashboardModalProps) => {
  // TODO: how should state.error be handled?
  const { state, onRestoreDashboard } = useDashboardRestore(id, version);

  useEffect(() => {
    if (!state.loading && state.value) {
      hideModal();
    }
  }, [state, hideModal]);

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
