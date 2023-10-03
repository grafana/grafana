import React from 'react';

import { Button, ModalsController } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DashboardModel } from '../../state';

import { DeleteDashboardModal } from './DeleteDashboardModal';

type Props = {
  dashboard: DashboardModel;
};

export const DeleteDashboardButton = ({ dashboard }: Props) => (
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
