import React from 'react';
import { NEW_DASHBOARD_DEFAULT_TITLE } from './forms/SaveDashboardAsForm';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModalProps } from './types';
import { SaveDashboardModal } from './SaveDashboardModal';

export const SaveDashboardModalProxy: React.FC<SaveDashboardModalProps> = ({ dashboard, onDismiss, onSaveSuccess }) => {
  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.title === NEW_DASHBOARD_DEFAULT_TITLE;
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
