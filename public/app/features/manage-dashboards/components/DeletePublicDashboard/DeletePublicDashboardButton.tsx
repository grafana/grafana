import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { ComponentSize, Icon, LinkButton, ModalsController, Spinner } from '@grafana/ui/src';

import { useDeletePublicDashboardMutation } from '../../../dashboard/api/publicDashboardApi';
import { ListPublicDashboardResponse } from '../../types';

import { DeletePublicDashboardModal } from './DeletePublicDashboardModal';

export const DeletePublicDashboardButton = ({
  publicDashboard,
  size,
}: {
  publicDashboard: ListPublicDashboardResponse;
  size: ComponentSize;
}) => {
  const [deletePublicDashboard, { isLoading }] = useDeletePublicDashboardMutation();

  const onDeletePublicDashboardClick = (pd: ListPublicDashboardResponse, onDelete: () => void) => {
    deletePublicDashboard({ uid: pd.uid, dashboardUid: pd.dashboardUid, dashboardTitle: pd.title });
    onDelete();
  };

  const selectors = e2eSelectors.pages.PublicDashboards;

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <LinkButton
          fill="text"
          aria-label="Delete public dashboard configuration"
          title="Delete public dashboard configuration"
          onClick={() =>
            showModal(DeletePublicDashboardModal, {
              dashboardTitle: publicDashboard.title,
              onConfirm: () => onDeletePublicDashboardClick(publicDashboard, hideModal),
              onDismiss: hideModal,
            })
          }
          data-testid={selectors.trashcanButton}
          size={size}
        >
          {isLoading ? <Spinner /> : <Icon size={size} name="trash-alt" />}
        </LinkButton>
      )}
    </ModalsController>
  );
};
