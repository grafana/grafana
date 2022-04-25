import React from 'react';

import { config } from '@grafana/runtime';

import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardModal } from './SaveDashboardModal';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';
import { SaveDashboardModalProps } from './types';

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
