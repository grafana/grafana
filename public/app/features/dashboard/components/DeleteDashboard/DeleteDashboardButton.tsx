import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Button, ModalsController } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';

import { DeleteDashboardModal } from './DeleteDashboardModal';

export const DeleteDashboardButton = () => {
  const dashboard = getDashboardSrv().getCurrent()!;
  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Button
          variant="destructive"
          onClick={() => {
            showModal(DeleteDashboardModal, {
              dashboard,
              hideModal,
            });
          }}
          data-testid={selectors.pages.Dashboard.Settings.General.deleteDashBoard}
        >
          <Trans i18nKey="dashboard-settings.dashboard-delete-button">Delete dashboard</Trans>
        </Button>
      )}
    </ModalsController>
  );
};
