import { css } from '@emotion/css';
import { connect, ConnectedProps } from 'react-redux';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { Trans, t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Modal, Button, Text, Space, TextLink } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { cleanUpDashboardAndVariables } from 'app/features/dashboard/state/actions';

import { useDeleteItemsMutation } from '../../../browse-dashboards/api/browseDashboardsAPI';
import { DeleteDashboardModal as DeleteModal } from '../../../dashboard-scene/settings/DeleteDashboardButton';

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
  const [deleteItems] = useDeleteItemsMutation();

  const [, onConfirm] = useAsyncFn(async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: 1,
      },
      source: 'dashboard_settings',
      restore_enabled: Boolean(config.featureToggles.restoreDashboards),
    });
    await deleteItems({
      selectedItems: {
        dashboard: {
          [dashboard.uid]: true,
        },
        folder: {},
      },
    });
    cleanUpDashboardAndVariables();
    hideModal();
    locationService.replace('/');
  }, [hideModal]);

  if (isProvisioned) {
    return <ProvisionedDeleteModal hideModal={hideModal} provisionedId={dashboard.meta.provisionedExternalId!} />;
  }

  return <DeleteModal onConfirm={onConfirm} onClose={hideModal} dashboardTitle={dashboard.title} />;
};

const ProvisionedDeleteModal = ({ hideModal, provisionedId }: { hideModal(): void; provisionedId: string }) => {
  return (
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
};

export const DeleteDashboardModal = connector(DeleteDashboardModalUnconnected);
