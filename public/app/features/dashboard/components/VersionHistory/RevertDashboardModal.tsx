import React from 'react';
import { css } from 'emotion';
import { HorizontalGroup, Modal, Button } from '@grafana/ui';
import { useDashboardRestore } from './useDashboardRestore';
export interface RevertDashboardModalProps {
  hideModal: () => void;
  version: number;
}

export const RevertDashboardModal: React.FC<RevertDashboardModalProps> = ({ hideModal, version }) => {
  // TODO: how should state.error be handled?
  const { onRestoreDashboard } = useDashboardRestore(version);

  return (
    <Modal
      isOpen={true}
      title="Restore Version"
      icon="history"
      onDismiss={hideModal}
      className={css`
        text-align: center;
        width: 500px;
      `}
    >
      <p>Are you sure you want to restore the dashboard to version {version}? All unsaved changes will be lost.</p>
      <HorizontalGroup justify="center">
        <Button variant="destructive" type="button" onClick={onRestoreDashboard}>
          Yes, restore to version {version}
        </Button>
        <Button variant="secondary" onClick={hideModal}>
          Cancel
        </Button>
      </HorizontalGroup>
    </Modal>
  );
};
