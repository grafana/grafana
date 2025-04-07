import { useAsyncFn, useToggle } from 'react-use';

import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, Modal, Space, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { useDeleteItemsMutation } from '../../browse-dashboards/api/browseDashboardsAPI';
import { ProvisionedResourceDeleteModal } from '../saving/provisioned/ProvisionedResourceDeleteModal';
import { DashboardScene } from '../scene/DashboardScene';

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
  const [deleteItems] = useDeleteItemsMutation();

  const [, onConfirm] = useAsyncFn(async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: 1,
      },
      source: 'dashboard_scene_settings',
      restore_enabled: false,
    });
    toggleModal();
    if (dashboard.state.uid) {
      await deleteItems({
        selectedItems: {
          dashboard: {
            [dashboard.state.uid]: true,
          },
          folder: {},
        },
      });
    }
    await dashboard.onDashboardDelete();
  }, [dashboard, toggleModal]);

  if (dashboard.state.meta.provisioned && showModal) {
    return <ProvisionedDeleteModal dashboardId={dashboard.state.meta.provisionedExternalId} onClose={toggleModal} />;
  }

  if (dashboard.isManagedRepository() && showModal) {
    return <ProvisionedResourceDeleteModal resource={dashboard} onDismiss={toggleModal} />;
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
          {false && ( // TODO: re-enable when restore is reworked
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
        This dashboard is managed by Grafana provisioning and cannot be deleted. Remove the dashboard from the config
        file to delete it.
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
        File path: {dashboardId}
      </p>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={onClose}>
          <Trans i18nKey="dashboard-scene.provisioned-delete-modal.ok">OK</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
