import React from 'react';

import { ConfirmModal } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { DecoratedRevisionModel } from '../VersionsEditView';

export interface RevertDashboardModalProps {
  hideModal: () => void;
  onRestore: (version: DecoratedRevisionModel) => void;
  version: DecoratedRevisionModel;
}

export const RevertDashboardModal = ({ hideModal, onRestore, version }: RevertDashboardModalProps) => {
  const notifyApp = useAppNotification();

  const onRestoreDashboard = async () => {
    onRestore(version);
    notifyApp.success('Dashboard restored', `Restored from version ${version.version}`);
    hideModal();
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
