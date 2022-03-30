import React from 'react';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModalProps } from './types';
import { SaveDashboardModal } from './SaveDashboardModal';
import { config } from '@grafana/runtime';
import { SaveDashboardDrawer } from './SaveDashboardDrawer';

export const SaveDashboardProxy: React.FC<SaveDashboardModalProps> = ({
  dashboard,
  onDismiss,
  onSaveSuccess,
  isCopy,
}) => {
  if (config.featureToggles.saveDashboardDrawer) {
    return (
      <SaveDashboardDrawer dashboard={dashboard} onDismiss={onDismiss} onSaveSuccess={onSaveSuccess} isCopy={isCopy} />
    );
  }

  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.version === 0;
  const isChanged = dashboard.version > 0;

  const modalProps = {
    dashboard,
    onDismiss,
    onSaveSuccess,
    isCopy,
  };

  if (isNew || isCopy) {
    return <SaveDashboardAsModal {...modalProps} isNew />;
  }
  return (
    <>
      {isChanged && !isProvisioned && <SaveDashboardModal {...modalProps} />}
      {isProvisioned && <SaveProvisionedDashboard {...modalProps} />}
    </>
  );
};
