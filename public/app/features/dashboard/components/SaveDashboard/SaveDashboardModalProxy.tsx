import React from 'react';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModalProps } from './types';
import { SaveDashboardModal } from './SaveDashboardModal';
import { config } from '@grafana/runtime';
import { SaveDashboardDrawer } from './SaveDashboardDrawer';

export const SaveDashboardModalProxy: React.FC<SaveDashboardModalProps> = ({
  dashboard,
  onDismiss,
  onSaveSuccess,
  isCopy,
}) => {
  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.version === 0;
  const isChanged = dashboard.version > 0;

  const modalProps = {
    dashboard,
    onDismiss,
    onSaveSuccess,
    isCopy,
  };

  // Feature flag to show save as a drawer (and diff) rather than just simple modal
  if (true || config.featureToggles.saveWithDiff) {
    return <SaveDashboardDrawer {...modalProps} />;
  }

  return (
    <>
      {isChanged && !isProvisioned && <SaveDashboardModal {...modalProps} />}
      {isProvisioned && <SaveProvisionedDashboard {...modalProps} />}
      {(isNew || isCopy) && <SaveDashboardAsModal {...modalProps} isNew />}
    </>
  );
};
