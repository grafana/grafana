import React from 'react';
import { NEW_DASHBOARD_DEFAULT_TITLE } from './forms/SaveDashboardAsForm';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModalProps } from './types';
import { SaveDashboardModal } from './SaveDashboardModal';
import { connectWithProvider } from '../../../utils/connectWithReduxStore';
import { ModalRoot, ModalsProvider } from '@grafana/ui';

export const SaveDashboardModalProxy: React.FC<SaveDashboardModalProps> = ({ dashboard, onClose, onSaveSuccess }) => {
  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.title === NEW_DASHBOARD_DEFAULT_TITLE;
  const isChanged = dashboard.version > 0;

  const modalProps = {
    dashboard,
    onClose,
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

// This component is created to enable rendering save modal from KeybindingsSrv
// It renders ModalsProvider with default modal applied
export const SaveDashboardModalProxyAngular = connectWithProvider((props: any) => {
  return (
    <>
      <ModalsProvider {...props}>
        <ModalRoot />
      </ModalsProvider>
    </>
  );
});
