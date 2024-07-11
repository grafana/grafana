import { reportInteraction } from '@grafana/runtime';
import { ConfirmModal, Text } from '@grafana/ui';

import { Trans, t } from '../../../core/internationalization';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedDashboards: string[];
  isLoading: boolean;
}

export const RestoreModal = ({ onConfirm, onDismiss, selectedDashboards, isLoading, ...props }: Props) => {
  const numberOfDashboards = selectedDashboards.length;

  const onRestore = async () => {
    reportInteraction('grafana_restore_confirm_clicked', {
      item_counts: {
        dashboard: numberOfDashboards,
      },
    });
    await onConfirm();
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <Text element="p">
          <Trans i18nKey="recently-deleted.restore-modal.text" count={numberOfDashboards}>
            This action will restore {{ numberOfDashboards }} dashboards.
          </Trans>
        </Text>
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
      {...props}
    />
  );
};
