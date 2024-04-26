import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { locationService } from '@grafana/runtime';
import { Modal, ConfirmModal, Button } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state';
import { cleanUpDashboardAndVariables } from 'app/features/dashboard/state/actions';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';

type DeleteDashboardModalProps = {
  hideModal(): void;
  dashboard: DashboardModel;
};

const mapDispatchToProps = {
  cleanUpDashboardAndVariables,
};

const connector = connect(null, mapDispatchToProps);

type Props = DeleteDashboardModalProps & ConnectedProps<typeof connector>;

const DeleteDashboardModalUnconnected = ({ hideModal, cleanUpDashboardAndVariables, dashboard }: Props) => {
  const isProvisioned = dashboard.meta.provisioned;

  const [, onConfirm] = useAsyncFn(async () => {
    await deleteDashboard(dashboard.uid, true);
    cleanUpDashboardAndVariables();
    hideModal();
    locationService.replace('/');
  }, [hideModal]);

  if (isProvisioned) {
    return <ProvisionedDeleteModal hideModal={hideModal} provisionedId={dashboard.meta.provisionedExternalId!} />;
  }

  return (
    <ConfirmModal
      isOpen={true}
      body={
        <>
          <p>Do you want to delete this dashboard?</p>
          <p>{dashboard.title}</p>
        </>
      }
      onConfirm={onConfirm}
      onDismiss={hideModal}
      title="Delete"
      icon="trash-alt"
      confirmText="Delete"
    />
  );
};

const ProvisionedDeleteModal = ({ hideModal, provisionedId }: { hideModal(): void; provisionedId: string }) => (
  <Modal
    isOpen={true}
    title="Cannot delete provisioned dashboard"
    icon="trash-alt"
    onDismiss={hideModal}
    className={css`
      width: 500px;
    `}
  >
    <p>
      This dashboard is managed by Grafana provisioning and cannot be deleted. Remove the dashboard from the config file
      to delete it.
    </p>
    <p>
      <i>
        See{' '}
        <a
          className="external-link"
          href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards"
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
    <Modal.ButtonRow>
      <Button variant="primary" onClick={hideModal}>
        OK
      </Button>
    </Modal.ButtonRow>
  </Modal>
);

export const DeleteDashboardModal = connector(DeleteDashboardModalUnconnected);
