import React from 'react';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModalProps } from './types';
import { SaveDashboardModal } from './SaveDashboardModal';

export const SaveDashboardModalProxy: React.FC<SaveDashboardModalProps> = ({ dashboard, onDismiss, onSaveSuccess }) => {
  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.version === 0;
  const isChanged = dashboard.version > 0;

  const modalProps = {
    dashboard,
    onDismiss,
    onSaveSuccess,
  };

  return (
    <>
      {isChanged && !isProvisioned && <SaveDashboardModal {...modalProps} />}
      {isProvisioned && <SaveProvisionedDashboard {...modalProps} />}
      {isNew && <SaveDashboardAsModal {...modalProps} isNew />}
    </>
  );
};
