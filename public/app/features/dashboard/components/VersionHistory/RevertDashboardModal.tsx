import { useEffect } from 'react';

import { Trans, t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

import { useDashboardRestore } from './useDashboardRestore';
export interface RevertDashboardModalProps {
  hideModal: () => void;
  id: number;
  version: number;
}

export const RevertDashboardModal = ({ hideModal, id, version }: RevertDashboardModalProps) => {
  // TODO: how should state.error be handled?
  const { state, onRestoreDashboard } = useDashboardRestore(id, version);

  useEffect(() => {
    if (!state.loading && state.value) {
      hideModal();
    }
  }, [state, hideModal]);

  return (
    <ConfirmModal
      isOpen={true}
      title={t('dashboard.revert-dashboard-modal.title-restore-version', 'Restore version')}
      icon="history"
      onDismiss={hideModal}
      onConfirm={onRestoreDashboard}
      body={
        <p>
          <Trans i18nKey="dashboard.revert-dashboard-modal.body-restore-version">
            Are you sure you want to restore the dashboard to version {{ version }}? All unsaved changes will be lost.
          </Trans>
        </p>
      }
      confirmText={t(
        'dashboard.revert-dashboard-modal.confirmText-restore-version',
        'Yes, restore to version {{version}}',
        { version }
      )}
    />
  );
};
