import { Trans, t } from '@grafana/i18n';
import { Alert, ConfirmModal } from '@grafana/ui';

interface DeleteTokenConfirmationModalProps {
  isOpen: boolean;
  hasError: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function DeleteTokenConfirmationModal(props: DeleteTokenConfirmationModalProps) {
  const { isOpen, hasError, onConfirm, onDismiss } = props;

  const body = (
    <>
      <p>
        <Trans i18nKey="migrate-to-cloud.delete-migration-token-confirm.body">
          If you&apos;ve already used this token with a self-managed installation, that installation will no longer be
          able to upload content.
        </Trans>
      </p>

      {hasError && (
        <Alert
          severity="error"
          title={t('migrate-to-cloud.delete-migration-token-confirm.error-title', 'Error deleting token')}
        />
      )}
    </>
  );

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('migrate-to-cloud.delete-migration-token-confirm.title', 'Delete migration token')}
      body={body}
      confirmText={t('migrate-to-cloud.delete-migration-token-confirm.confirm-button', 'Delete token')}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
}
