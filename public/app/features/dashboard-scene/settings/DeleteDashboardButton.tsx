import { useAsyncFn, useToggle } from 'react-use';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, Modal, Space, Text, TextLink } from '@grafana/ui';

import { useDeleteDashboardsMutation } from '../../browse-dashboards/api/browseDashboardsAPI';
import { DashboardScene } from '../scene/DashboardScene';

import { DeleteProvisionedDashboardDrawer } from './DeleteProvisionedDashboardDrawer';

interface ButtonProps {
  dashboard: DashboardScene;
}

interface ProvisionedDeleteModalProps {
  dashboardId: string | undefined;
  onClose: () => void;
}

interface DeleteModalProps {
  dashboardTitle: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteDashboardButton({ dashboard }: ButtonProps) {
  const [showModal, toggleModal] = useToggle(false);
  const [deleteDashboards] = useDeleteDashboardsMutation();

  const [, onConfirm] = useAsyncFn(async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: 1,
      },
      source: 'dashboard_scene_settings',
      restore_enabled: Boolean(config.featureToggles.restoreDashboards),
    });
    toggleModal();
    if (dashboard.state.uid) {
      await deleteDashboards({ dashboardUIDs: [dashboard.state.uid] });
    }
    await dashboard.onDashboardDelete();
  }, [dashboard, toggleModal]);

  // Git managed dashboard
  if (dashboard.isManagedRepository() && showModal) {
    return <DeleteProvisionedDashboardDrawer dashboard={dashboard} onDismiss={toggleModal} />;
  }

  // classic provisioning
  if (dashboard.state.meta.provisioned && showModal) {
    return <ProvisionedDeleteModal dashboardId={dashboard.state.meta.provisionedExternalId} onClose={toggleModal} />;
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={toggleModal}
        data-testid={selectors.pages.Dashboard.Settings.General.deleteDashBoard}
      >
        <Trans i18nKey="dashboard-settings.dashboard-delete-button">Delete dashboard</Trans>
      </Button>

      {showModal && (
        <DeleteDashboardModal dashboardTitle={dashboard.state.title} onConfirm={onConfirm} onClose={toggleModal} />
      )}
    </>
  );
}

export function DeleteDashboardModal({ dashboardTitle, onConfirm, onClose }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={true}
      body={
        <>
          {config.featureToggles.restoreDashboards && (
            <>
              <Text element="p">
                <Trans i18nKey="dashboard-settings.delete-modal-restore-dashboards-text">
                  This action will mark the dashboard for deletion in 30 days. Your organization administrator can
                  restore it anytime before the 30 days expire.
                </Trans>
              </Text>
              <Space v={1} />
            </>
          )}
          <Text element="p">
            <Trans i18nKey="dashboard-settings.delete-modal-text">Do you want to delete this dashboard?</Trans>
          </Text>
          <Text element="p">{dashboardTitle}</Text>
          <Space v={2} />
        </>
      }
      onConfirm={onConfirm}
      onDismiss={onClose}
      title={t('dashboard-settings.delete-modal.title', 'Delete')}
      icon="trash-alt"
      confirmText={t('dashboard-settings.delete-modal.delete-button', 'Delete')}
      confirmationText={t('dashboard-settings.delete-modal.confirmation-text', 'Delete')}
    />
  );
}

function ProvisionedDeleteModal({ dashboardId, onClose }: ProvisionedDeleteModalProps) {
  return (
    <Modal
      isOpen={true}
      title={t(
        'dashboard-scene.provisioned-delete-modal.title-cannot-delete-provisioned-dashboard',
        'Cannot delete provisioned dashboard'
      )}
      icon="trash-alt"
      onDismiss={onClose}
    >
      <p>
        <Trans i18nKey="dashboard-scene.provisioned-delete-modal.cannot-be-deleted">
          This dashboard is managed by Grafana provisioning and cannot be deleted. Remove the dashboard from the config
          file to delete it.
        </Trans>
      </p>
      <p>
        <i>
          <Trans i18nKey="dashboard-scene.provisioned-delete-modal.see-docs">
            See{' '}
            <TextLink href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards" external>
              documentation
            </TextLink>{' '}
            for more information about provisioning.
          </Trans>
        </i>
        <br />
        <Trans i18nKey="dashboard-scene.provisioned-delete-modal.file-path">File path: {{ dashboardId }}</Trans>
      </p>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={onClose}>
          <Trans i18nKey="dashboard-scene.provisioned-delete-modal.ok">OK</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
