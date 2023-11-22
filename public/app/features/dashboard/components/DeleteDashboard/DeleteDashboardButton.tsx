import React from 'react';

import { Button, ModalsController } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

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
          aria-label="Dashboard settings page delete dashboard button"
        >
          <Trans i18nKey="dashboard-settings.dashboard-delete-button">Delete Dashboard</Trans>
        </Button>
      )}
    </ModalsController>
  );
};
