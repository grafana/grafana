import * as React from 'react';

import { config } from '@grafana/runtime';
import { Button, ModalsController, ButtonProps } from '@grafana/ui/src';
import { t } from 'app/core/internationalization';
import { useDeletePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { DeletePublicDashboardModal } from './DeletePublicDashboardModal';

export interface PublicDashboardDeletion {
  uid: string;
  dashboardUid: string;
  title: string;
}

export const DeletePublicDashboardButton = ({
  dashboard,
  publicDashboard,
  loader,
  children,
  onDismiss,
  ...rest
}: {
  dashboard?: DashboardModel;
  publicDashboard: PublicDashboardDeletion;
  loader?: JSX.Element;
  children?: React.ReactNode;
  onDismiss?: () => void;
} & ButtonProps) => {
  const [deletePublicDashboard, { isLoading }] = useDeletePublicDashboardMutation();

  const onDeletePublicDashboardClick = (pd: PublicDashboardDeletion, onDelete: () => void) => {
    deletePublicDashboard({
      dashboard,
      uid: pd.uid,
      dashboardUid: pd.dashboardUid,
    });
    onDelete();
  };

  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        const translatedRevocationButtonText = config.featureToggles.newDashboardSharingComponent
          ? t('shared-dashboard-list.button.revoke-button-text', 'Revoke access')
          : t('public-dashboard-list.button.revoke-button-text', 'Revoke public URL');
        return (
          <Button
            aria-label={translatedRevocationButtonText}
            title={translatedRevocationButtonText}
            onClick={() =>
              showModal(DeletePublicDashboardModal, {
                onConfirm: () => onDeletePublicDashboardClick(publicDashboard, hideModal),
                onDismiss: () => {
                  onDismiss ? onDismiss() : hideModal();
                },
              })
            }
            {...rest}
          >
            {isLoading && loader ? loader : children}
          </Button>
        );
      }}
    </ModalsController>
  );
};
