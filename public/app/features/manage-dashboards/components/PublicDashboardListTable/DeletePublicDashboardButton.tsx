import React from 'react';

import { Button, ModalsController, ButtonProps } from '@grafana/ui/src';
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
  children: React.ReactNode;
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
      {({ showModal, hideModal }) => (
        <Button
          aria-label="Revoke public URL"
          title="Revoke public URL"
          onClick={() =>
            showModal(DeletePublicDashboardModal, {
              dashboardTitle: publicDashboard.title,
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
      )}
    </ModalsController>
  );
};
