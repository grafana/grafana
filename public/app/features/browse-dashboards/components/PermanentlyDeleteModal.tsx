import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ConfirmModal, Text } from '@grafana/ui';

interface PermanentlyDeleteModalProps {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedDashboards: string[];
  isLoading: boolean;
}

export const PermanentlyDeleteModal = ({
  onConfirm,
  onDismiss,
  selectedDashboards,
  isLoading,
  ...props
}: PermanentlyDeleteModalProps) => {
  const numberOfDashboards = selectedDashboards.length;

  const onDelete = async () => {
    reportInteraction('grafana_delete_permanently_confirm_clicked', {
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
          <Trans i18nKey="recently-deleted.permanently-delete-modal.text" count={numberOfDashboards}>
            This action will delete {{ numberOfDashboards }} dashboards.
          </Trans>
        </Text>
      }
      title={t('recently-deleted.permanently-delete-modal.title', 'Permanently Delete Dashboards')}
      confirmationText={t('recently-deleted.permanently-delete-modal.confirm-text', 'Delete')}
      confirmText={
        isLoading
          ? t('recently-deleted.permanently-delete-modal.delete-loading', 'Deleting...')
          : t('recently-deleted.permanently-delete-modal.delete-button', 'Delete')
      }
      confirmButtonVariant="destructive"
      onConfirm={onDelete}
      onDismiss={onDismiss}
      {...props}
    />
  );
};
