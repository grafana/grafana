import React from 'react';

import { ConfirmModal } from '@grafana/ui';

import { DecoratedRevisionModel } from '../VersionsEditView';

export interface RevertDashboardModalProps {
  hideModal: () => void;
  version: DecoratedRevisionModel;
  onRestore: (version: DecoratedRevisionModel) => void;
}

export const RevertDashboardModal = ({ hideModal, onRestore, version }: RevertDashboardModalProps) => {
  // TODO: how should state.error be handled?
  // const { state, onRestoreDashboard } = useDashboardRestore(version);

  const onRestoreDashboard = async () => {
    await onRestore(version);
  };

  return (
    <ConfirmModal
      isOpen={true}
      title="Restore Version"
      icon="history"
      onDismiss={hideModal}
      onConfirm={onRestoreDashboard}
      body={
        <p>
          Are you sure you want to restore the dashboard to version {version.version}? All unsaved changes will be lost.
        </p>
      }
      confirmText={`Yes, restore to version ${version.version}`}
    />
  );
};
