import React, { ButtonHTMLAttributes } from 'react';
import { css } from 'emotion';
import { ButtonVariant, Forms, ModalsController } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state';
import { connectWithProvider } from 'app/core/utils/connectWithReduxStore';
import { provideModalsContext } from 'app/routes/ReactContainer';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModalProxy } from './SaveDashboardModalProxy';

interface SaveDashboardButtonProps {
  dashboard: DashboardModel;
  /**
   * Added for being able to render this component as Angular directive!
   * TODO[angular-migrations]: Remove when we migrate Dashboard Settings view to React
   */
  getDashboard?: () => DashboardModel;
  onSaveSuccess?: () => void;
  variant?: ButtonVariant;
}

export const SaveDashboardButton: React.FC<SaveDashboardButtonProps> = ({
  dashboard,
  onSaveSuccess,
  variant,
  getDashboard,
}) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Forms.Button
            onClick={() => {
              showModal(SaveDashboardModalProxy, {
                // TODO[angular-migrations]: Remove tenary op when we migrate Dashboard Settings view to React
                dashboard: getDashboard ? getDashboard() : dashboard,
                onSaveSuccess,
                onDismiss: hideModal,
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

export const SaveDashboardAsButton: React.FC<SaveDashboardButtonProps> = ({
  dashboard,
  onSaveSuccess,
  variant,
  getDashboard,
}) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Forms.Button
            /* Styles applied here are specific to dashboard settings view */
            className={css`
              width: 100%;
              justify-content: center;
            `}
            onClick={() => {
              showModal(SaveDashboardAsModal, {
                // TODO[angular-migrations]: Remove tenary op when we migrate Dashboard Settings view to React
                dashboard: getDashboard ? getDashboard() : dashboard,
                onSaveSuccess,
                onDismiss: hideModal,
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
