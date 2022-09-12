import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, ButtonVariant, ComponentSize, ModalsController } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';

interface SaveDashboardButtonProps {
  dashboard: DashboardModel;
  onSaveSuccess?: () => void;
  size?: ComponentSize;
}

export const SaveDashboardButton: React.FC<SaveDashboardButtonProps> = ({ dashboard, onSaveSuccess, size }) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Button
            size={size}
            onClick={() => {
              showModal(SaveDashboardDrawer, {
                dashboard,
                onSaveSuccess,
                onDismiss: hideModal,
              });
            }}
            aria-label={selectors.pages.Dashboard.Settings.General.saveDashBoard}
          >
            Save dashboard
          </Button>
        );
      }}
    </ModalsController>
  );
};

export const SaveDashboardAsButton: React.FC<SaveDashboardButtonProps & { variant?: ButtonVariant }> = ({
  dashboard,
  onSaveSuccess,
  variant,
  size,
}) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Button
            size={size}
            onClick={() => {
              showModal(SaveDashboardDrawer, {
                dashboard,
                onSaveSuccess,
                onDismiss: hideModal,
                isCopy: true,
              });
            }}
            variant={variant}
            aria-label={selectors.pages.Dashboard.Settings.General.saveAsDashBoard}
          >
            Save as
          </Button>
        );
      }}
    </ModalsController>
  );
};
