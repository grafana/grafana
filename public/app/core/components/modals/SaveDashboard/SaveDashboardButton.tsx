import { SaveDashboardModalProxy } from './SaveDashboardModalProxy';
import { ModalsController, Forms, ButtonVariant } from '@grafana/ui';
import React from 'react';
import { DashboardModel } from '../../../../features/dashboard/state';
import { connectWithProvider } from '../../../utils/connectWithReduxStore';
import { provideModalsContext } from 'app/routes/ReactContainer';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';

interface SaveDashboardButtonProps {
  dashboard: DashboardModel;
  onSaveSuccess?: () => void;
  variant?: ButtonVariant;
}

export const SaveDashboardButton: React.FC<SaveDashboardButtonProps> = ({ dashboard, onSaveSuccess, variant }) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Forms.Button
            onClick={() => {
              showModal(SaveDashboardModalProxy, {
                dashboard,
                onSaveSuccess,
                onClose: hideModal,
              });
            }}
            variant={variant || 'primary-legacy'}
          >
            Save dashboard
          </Forms.Button>
        );
      }}
    </ModalsController>
  );
};

export const SaveDashboardAsButton: React.FC<SaveDashboardButtonProps> = ({ dashboard, onSaveSuccess, variant }) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Forms.Button
            onClick={() => {
              showModal(SaveDashboardAsModal, {
                dashboard,
                onSaveSuccess,
                onClose: hideModal,
              });
            }}
            variant={variant || 'secondary'}
          >
            Save As...
          </Forms.Button>
        );
      }}
    </ModalsController>
  );
};

// TODO: this is an ugly solution for the save button to have access to Redux and Modals controller
// When we migrate dashboard settings to Angular it won't be necessary.
export const SaveDashboardButtonConnected = connectWithProvider(provideModalsContext(SaveDashboardButton));
export const SaveDashboardAsButtonConnected = connectWithProvider(provideModalsContext(SaveDashboardAsButton));
