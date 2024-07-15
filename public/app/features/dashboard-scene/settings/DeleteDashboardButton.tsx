import { useAsyncFn, useToggle } from 'react-use';

import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, Modal } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DashboardScene } from '../scene/DashboardScene';

interface ButtonProps {
  dashboard: DashboardScene;
}

export function DeleteDashboardButton({ dashboard }: ButtonProps) {
  const [showModal, toggleModal] = useToggle(false);

  return (
    <>
      <Button
        variant="destructive"
        onClick={toggleModal}
        data-testid={selectors.pages.Dashboard.Settings.General.deleteDashBoard}
      >
        <Trans i18nKey="dashboard-settings.dashboard-delete-button">Delete dashboard</Trans>
      </Button>

      {showModal && <DeleteDashboardModal dashboard={dashboard} onClose={toggleModal} />}
    </>
  );
}

interface ModalProps {
  dashboard: DashboardScene;
  onClose: () => void;
}

function DeleteDashboardModal({ dashboard, onClose }: ModalProps) {
  const [, onConfirm] = useAsyncFn(async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: 1,
      },
      source: 'dashboard_scene_settings',
      restore_enabled: config.featureToggles.dashboardRestoreUI,
    });
    onClose();
    await dashboard.deleteDashboard();
  }, [dashboard, onClose]);

  if (dashboard.state.meta.provisioned) {
    return <ProvisionedDeleteModal dashboard={dashboard} onClose={onClose} />;
  }

  return (
    <ConfirmModal
      isOpen={true}
      body={
        <>
          <p>Do you want to delete this dashboard?</p>
          <p>{dashboard.state.title}</p>
        </>
      }
      onConfirm={onConfirm}
      onDismiss={onClose}
      title="Delete"
      icon="trash-alt"
      confirmText="Delete"
    />
  );
}

function ProvisionedDeleteModal({ dashboard, onClose }: ModalProps) {
  return (
    <Modal isOpen={true} title="Cannot delete provisioned dashboard" icon="trash-alt" onDismiss={onClose}>
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
        File path: {dashboard.state.meta.provisionedExternalId}
      </p>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={onClose}>
          OK
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
