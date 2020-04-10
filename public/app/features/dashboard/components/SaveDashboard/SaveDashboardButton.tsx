import React from 'react';
import { Button, ButtonVariant, ModalsController, FullWidthButtonContainer } from '@grafana/ui';
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
  useNewForms?: boolean;
}

export const SaveDashboardButton: React.FC<SaveDashboardButtonProps> = ({
  dashboard,
  onSaveSuccess,
  getDashboard,
  useNewForms,
}) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Button
            onClick={() => {
              showModal(SaveDashboardModalProxy, {
                // TODO[angular-migrations]: Remove tenary op when we migrate Dashboard Settings view to React
                dashboard: getDashboard ? getDashboard() : dashboard,
                onSaveSuccess,
                onDismiss: hideModal,
              });
            }}
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
  getDashboard,
  variant,
}) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <FullWidthButtonContainer>
            <Button
              onClick={() => {
                showModal(SaveDashboardAsModal, {
                  // TODO[angular-migrations]: Remove tenary op when we migrate Dashboard Settings view to React
                  dashboard: getDashboard ? getDashboard() : dashboard,
                  onSaveSuccess,
                  onDismiss: hideModal,
                });
              }}
              // TODO[angular-migrations]: Hacking the different variants for this single button
              // In Dashboard Settings in sidebar we need to use new form but with inverse variant to make it look like it should
              // Everywhere else we use old button component :(
              variant={variant as ButtonVariant}
            >
              Save As...
            </Button>
          </FullWidthButtonContainer>
        );
      }}
    </ModalsController>
  );
};

// TODO: this is an ugly solution for the save button to have access to Redux and Modals controller
// When we migrate dashboard settings to Angular it won't be necessary.
export const SaveDashboardButtonConnected = connectWithProvider(provideModalsContext(SaveDashboardButton));
export const SaveDashboardAsButtonConnected = connectWithProvider(provideModalsContext(SaveDashboardAsButton));
