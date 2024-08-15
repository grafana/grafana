import { useState } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { ConfirmModal, Text } from '@grafana/ui';

import { FolderPicker } from '../../../core/components/Select/FolderPicker';
import { Trans, t } from '../../../core/internationalization';

export interface RestoreModalProps {
  isOpen: boolean;
  onConfirm: (restoreTarget: string) => Promise<void>;
  onDismiss: () => void;
  selectedDashboards: string[];
  isLoading: boolean;
}

export const RestoreModal = ({ onConfirm, onDismiss, selectedDashboards, isLoading, ...props }: RestoreModalProps) => {
  const [restoreTarget, setRestoreTarget] = useState<string>();
  const numberOfDashboards = selectedDashboards.length;

  const onRestore = async () => {
    reportInteraction('grafana_restore_confirm_clicked', {
      item_counts: {
        dashboard: numberOfDashboards,
      },
    });
    if (restoreTarget !== undefined) {
      await onConfirm(restoreTarget);
      onDismiss();
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans i18nKey="recently-deleted.restore-modal.text" count={numberOfDashboards}>
              This action will restore {{ numberOfDashboards }} dashboards.
            </Trans>
          </Text>
          <Text element="p">
            <Trans i18nKey="recently-deleted.restore-modal.folder-picker-text">
              Please choose a folder where your dashboards will be restored.
            </Trans>
          </Text>
          <FolderPicker onChange={setRestoreTarget} value={restoreTarget} />
        </>
        // TODO: replace by list of dashboards (list up to 5 dashboards) or number (from 6 dashboards)?
      }
      confirmText={
        isLoading
          ? t('recently-deleted.restore-modal.restore-loading', 'Restoring...')
          : t('recently-deleted.restore-modal.restore-button', 'Restore')
      }
      confirmButtonVariant="primary"
      onDismiss={onDismiss}
      onConfirm={onRestore}
      title={t('recently-deleted.restore-modal.title', 'Restore Dashboards')}
      disabled={restoreTarget === undefined}
      {...props}
    />
  );
};
