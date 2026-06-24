import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, type ButtonVariant, type ComponentSize, ModalsController } from '@grafana/ui';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';

interface Props {
  dashboard: DashboardModel;
  onSaveSuccess?: () => void;
  size?: ComponentSize;
  onClick?: () => void;
  variant?: ButtonVariant;
}

<<<<<<< HEAD
export const SaveDashboardButton = ({ dashboard, onSaveSuccess, size }: SaveDashboardButtonProps) => {
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
            Сохранить дашборд
          </Button>
        );
      }}
    </ModalsController>
  );
};

type Props = SaveDashboardButtonProps & { variant?: ButtonVariant };

=======
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
export const SaveDashboardAsButton = ({ dashboard, onClick, onSaveSuccess, variant, size }: Props) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <Button
            size={size}
            onClick={() => {
              reportInteraction('grafana_dashboard_save_as_clicked');
              onClick?.();
              showModal(SaveDashboardDrawer, {
                dashboard,
                onSaveSuccess,
                onDismiss: hideModal,
                isCopy: true,
              });
            }}
            variant={variant}
            data-testid={selectors.pages.Dashboard.Settings.General.saveAsDashBoard}
          >
            <Trans i18nKey="dashboard.save-dashboard-as-button.save-as">Save as</Trans>
          </Button>
        );
      }}
    </ModalsController>
  );
};
