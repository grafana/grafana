import { ConfirmModal } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t, Trans } from 'app/core/internationalization';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DecoratedRevisionModel } from '../VersionsEditView';

export interface RevertDashboardModalProps {
  hideModal: () => void;
  onRestore: (version: DecoratedRevisionModel) => Promise<boolean>;
  version: DecoratedRevisionModel;
}

export const RevertDashboardModal = ({ hideModal, onRestore, version }: RevertDashboardModalProps) => {
  const notifyApp = useAppNotification();

  const onRestoreDashboard = async () => {
    const success = await onRestore(version);

    if (success) {
      notifyApp.success('Dashboard restored', `Restored from version ${version.version}`);
      DashboardInteractions.versionRestoreClicked({ version: version.version, confirm: true });
    } else {
      notifyApp.error('Dashboard restore failed', `Failed to restore from version ${version.version}`);
    }

    hideModal();
  };

  return (
    <ConfirmModal
      isOpen={true}
      title={t('dashboard-scene.revert-dashboard-modal.title-restore-version', 'Restore version')}
      icon="history"
      onDismiss={hideModal}
      onConfirm={onRestoreDashboard}
      body={
        <p>
          <Trans
            i18nKey="dashboard-scene.revert-dashboard-modal.body-restore-version"
            values={{ version: version.version }}
          >
            Are you sure you want to restore the dashboard to version {'{{version}}'}? All unsaved changes will be lost.
          </Trans>
        </p>
      }
      confirmText={`Yes, restore to version ${version.version}`}
    />
  );
};
