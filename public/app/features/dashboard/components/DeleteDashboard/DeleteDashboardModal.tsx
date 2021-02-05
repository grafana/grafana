import React from 'react';
import { css } from 'emotion';
import sumBy from 'lodash/sumBy';
import { Modal, ConfirmModal, HorizontalGroup, Button } from '@grafana/ui';
import { DashboardModel, PanelModel } from '../../state';
import { useDashboardDelete } from './useDashboardDelete';

type DeleteDashboardModalProps = {
  hideModal(): void;
  dashboard: DashboardModel;
};

export const DeleteDashboardModal: React.FC<DeleteDashboardModalProps> = ({ hideModal, dashboard }) => {
  const isProvisioned = dashboard.meta.provisioned;
  const { onRestoreDashboard } = useDashboardDelete(dashboard.uid);
  const modalBody = getModalBody(dashboard.panels, dashboard.title);

  if (isProvisioned) {
    return <ProvisionedDeleteModal hideModal={hideModal} provisionedId={dashboard.meta.provisionedExternalId!} />;
  }

  return (
    <ConfirmModal
      isOpen={true}
      body={modalBody}
      onConfirm={onRestoreDashboard}
      onDismiss={hideModal}
      title="Delete"
      icon="trash-alt"
      confirmText="Delete"
    />
  );
};

const getModalBody = (panels: PanelModel[], title: string) => {
  const totalAlerts = sumBy(panels, (panel) => (panel.alert ? 1 : 0));
  return totalAlerts > 0 ? (
    <>
      <p>Do you want to delete this dashboard?</p>
      <p>
        This dashboard contains {totalAlerts} alert{totalAlerts > 1 ? 's' : ''}. Deleting this dashboard will also
        delete those alerts
      </p>
    </>
  ) : (
    <>
      <p>Do you want to delete this dashboard?</p>
      <p>{title}</p>
    </>
  );
};

const ProvisionedDeleteModal = ({ hideModal, provisionedId }: { hideModal(): void; provisionedId: string }) => (
  <Modal
    isOpen={true}
    title="Cannot delete provisioned dashboard"
    icon="trash-alt"
    onDismiss={hideModal}
    className={css`
      text-align: center;
      width: 500px;
    `}
  >
    <p>
      This dashboard is managed by Grafanas provisioning and cannot be deleted. Remove the dashboard from the config
      file to delete it.
    </p>
    <p>
      <i>
        See{' '}
        <a
          className="external-link"
          href="http://docs.grafana.org/administration/provisioning/#dashboards"
          target="_blank"
          rel="noreferrer"
        >
          documentation
        </a>{' '}
        for more information about provisioning.
      </i>
      <br />
      File path: {provisionedId}
    </p>
    <HorizontalGroup justify="center">
      <Button variant="secondary" onClick={hideModal}>
        OK
      </Button>
    </HorizontalGroup>
  </Modal>
);
