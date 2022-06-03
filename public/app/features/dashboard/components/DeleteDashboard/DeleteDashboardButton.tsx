import React from 'react';

import { Button, ModalsController } from '@grafana/ui';

import { DashboardModel } from '../../state';

import { DeleteDashboardModal } from './DeleteDashboardModal';

type Props = {
  dashboard: DashboardModel;
  cleanDashboard: () => void;
};

export const DeleteDashboardButton = ({ dashboard, cleanDashboard }: Props) => (
  <ModalsController>
    {({ showModal, hideModal }) => (
      <Button
        variant="destructive"
        onClick={() => {
          showModal(DeleteDashboardModal, {
            dashboard,
            hideModal,
            cleanDashboard,
          });
        }}
        aria-label="Dashboard settings page delete dashboard button"
      >
        Delete Dashboard
      </Button>
    )}
  </ModalsController>
);
