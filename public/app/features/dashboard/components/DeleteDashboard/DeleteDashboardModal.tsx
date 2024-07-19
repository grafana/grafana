import { css } from '@emotion/css';
import { connect, ConnectedProps } from 'react-redux';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { locationService, config, reportInteraction } from '@grafana/runtime';
import { Modal, ConfirmModal, Button, Text, Space, TextLink } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state';
import { cleanUpDashboardAndVariables } from 'app/features/dashboard/state/actions';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';

import { Trans, t } from '../../../../core/internationalization';

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
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: 1,
      },
      source: 'dashboard_settings',
      restore_enabled: config.featureToggles.dashboardRestoreUI,
    });
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
          <Text element="p">
            <Trans i18nKey="dashboard-settings.dashboard-delete-modal.text">
              Do you want to delete this dashboard?
            </Trans>
          </Text>
          <Space v={1} />
          <Text element="p">{dashboard.title}</Text>
          <Space v={2} />
        </>
      }
      onConfirm={onConfirm}
      onDismiss={hideModal}
      title={t('dashboard-settings.dashboard-delete-modal.title', 'Delete')}
      icon="trash-alt"
      confirmText={t('dashboard-settings.dashboard-delete-modal.delete-button', 'Delete')}
      confirmationText={t('dashboard-settings.dashboard-delete-modal.confirmation-text', 'Delete')}
    />
  );
};

const ProvisionedDeleteModal = ({ hideModal, provisionedId }: { hideModal(): void; provisionedId: string }) => (
  <Modal
    isOpen={true}
    title={t('dashboard-settings.provisioned-delete-modal.title', 'Cannot delete provisioned dashboard')}
    icon="trash-alt"
    onDismiss={hideModal}
    className={css({
      width: '500px',
    })}
  >
    <Text element="p">
      <Trans i18nKey="dashboard-settings.provisioned-delete-modal.text-1">
        This dashboard is managed by Grafana provisioning and cannot be deleted. Remove the dashboard from the config
        file to delete it.
      </Trans>
    </Text>
    <Space v={1} />
    <Text element="p">
      <Trans i18nKey="dashboard-settings.provisioned-delete-modal.text-2">
        See grafana documentation for more information about provisioning.&nbsp;
      </Trans>
      <TextLink href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards" external>
        {t('dashboard-settings.provisioned-delete-modal.text-link', 'Go to docs page')}
      </TextLink>
    </Text>
    <Space v={2} />
    <Text element="p">
      <Trans i18nKey="dashboard-settings.provisioned-delete-modal.text-3">File path: {{ provisionedId }}</Trans>
    </Text>
    <Modal.ButtonRow>
      <Button variant="primary" onClick={hideModal}>
        <Trans i18nKey="dashboard-settings.provisioned-delete-modal.confirm-button">OK</Trans>
      </Button>
    </Modal.ButtonRow>
  </Modal>
);

export const DeleteDashboardModal = connector(DeleteDashboardModalUnconnected);
