import { SaveDashboardModalProxy } from './SaveDashboardModalProxy';
import { ModalsController, Forms } from '@grafana/ui';
import React from 'react';
import { DashboardModel } from '../../../../features/dashboard/state';
import { connectWithProvider } from '../../../utils/connectWithReduxStore';
import { provideModalsContext } from 'app/routes/ReactContainer';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';

interface SaveDashboardButtonProps {
  dashboard: DashboardModel;
  onSaveSuccess?: () => void;
}

export const SaveDashboardButton: React.FC<SaveDashboardButtonProps> = ({ dashboard, onSaveSuccess }) => {
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
          >
            Save dashboard
          </Forms.Button>
        );
      }}
    </ModalsController>
  );
};

export const SaveDashboardAsButton: React.FC<SaveDashboardButtonProps> = ({ dashboard, onSaveSuccess }) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Forms.Button
            variant="secondary"
            onClick={() => {
              showModal(SaveDashboardAsModal, {
                dashboard,
                onSaveSuccess,
                onClose: hideModal,
              });
            }}
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
