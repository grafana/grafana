import React from 'react';
import { css } from 'emotion';
import sumBy from 'lodash/sumBy';
import { Modal, HorizontalGroup, Button } from '@grafana/ui';
import { DashboardModel } from '../../state';

type DeleteDashboardModalProps = {
  hideModal: () => void;
  dashboard: DashboardModel;
};

export const DeleteDashboardModal: React.FC<DeleteDashboardModalProps> = ({ hideModal, dashboard }) => {
  const totalAlerts = sumBy(dashboard.panels, (panel) => {
    return panel.alert ? 1 : 0;
  });
  const isProvisioned = dashboard.meta.provisioned;

  if (isProvisioned) {
    return (
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
          File path: ${dashboard.meta.provisionedExternalId}
        </p>
        <HorizontalGroup justify="center">
          <Button variant="secondary" onClick={hideModal}>
            OK
          </Button>
        </HorizontalGroup>
      </Modal>
    );
  }

  if (totalAlerts > 0) {
    <Modal
      isOpen={true}
      title="Delete"
      icon="trash-alt"
      onDismiss={hideModal}
      className={css`
        text-align: center;
        width: 500px;
      `}
    >
      <p>Do you want to delete this dashboard?</p>
      <p>This dashboard contains ${totalAlerts} alerts. Deleting this dashboard will also delete those alerts</p>
      <HorizontalGroup justify="center">
        <Button variant="destructive" type="button" onClick={() => console.log('yes')}>
          Delete
        </Button>
        <Button variant="secondary" onClick={hideModal}>
          Cancel
        </Button>
      </HorizontalGroup>
    </Modal>;
  }

  return (
    <Modal
      isOpen={true}
      title="Delete"
      icon="trash-alt"
      onDismiss={hideModal}
      className={css`
        text-align: center;
        width: 500px;
      `}
    >
      <p>Do you want to delete this dashboard?</p>
      <p>{dashboard.title}</p>
      <HorizontalGroup justify="center">
        <Button variant="destructive" type="button" onClick={() => console.log('yes')}>
          Delete
        </Button>
        <Button variant="secondary" onClick={hideModal}>
          Cancel
        </Button>
      </HorizontalGroup>
    </Modal>
  );
};
