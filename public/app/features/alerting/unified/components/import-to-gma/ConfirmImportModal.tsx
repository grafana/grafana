import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Icon, Modal, Spinner, Stack, Text } from '@grafana/ui';

// Confirm Import Modal Component
interface ConfirmImportModalProps {
  isOpen: boolean;
  importStatus: 'idle' | 'importing' | 'success' | 'error' | 'partial-error';
  /** What the failed request reported. Missing when turning on Auto-sync failed, which has no message. */
  errorMessage?: string;
  /** Swaps the generic staging copy for Auto-sync-specific copy. */
  autoSyncActive: boolean;
  /** Whether the Rules step will also run in this same submit, alongside Auto-sync. */
  willImportRules: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ConfirmImportModal({
  isOpen,
  importStatus,
  errorMessage,
  autoSyncActive,
  willImportRules,
  onConfirm,
  onDismiss,
}: ConfirmImportModalProps) {
  const isImporting = importStatus === 'importing';
  const isSuccess = importStatus === 'success';
  const isError = importStatus === 'error';
  // Rules import failed after Auto-sync had already been persisted — distinct from Auto-sync
  // itself failing, so the copy must not claim Auto-sync failed.
  const isPartialError = importStatus === 'partial-error';

  // Only referenced from inside each body getter's Auto-sync branch below, so rules riding along
  // with Auto-sync just appends this fact rather than needing a fully separate sentence per stage
  // — the non-Auto-sync copy already covers rules implicitly via "resources".
  const rulesPendingNote = willImportRules && (
    <>
      {' '}
      <Trans i18nKey="alerting.import-to-gma.confirm.autosync-rules-note">
        Your selected alert rules will also be imported.
      </Trans>
    </>
  );
  const rulesImportedNote = willImportRules && (
    <>
      {' '}
      <Trans i18nKey="alerting.import-to-gma.confirm.autosync-rules-imported-note">
        Your selected alert rules were also imported.
      </Trans>
    </>
  );

  const getTitle = () => {
    if (isImporting) {
      return autoSyncActive
        ? t('alerting.import-to-gma.confirm.autosync-importing-title', 'Enabling auto-sync...')
        : t('alerting.import-to-gma.confirm.importing-title', 'Importing...');
    }
    if (isSuccess) {
      return autoSyncActive
        ? t('alerting.import-to-gma.confirm.autosync-success-title', 'Auto-sync Enabled')
        : t('alerting.import-to-gma.confirm.success-title', 'Import Successful');
    }
    if (isPartialError) {
      return t('alerting.import-to-gma.confirm.autosync-rules-error-title', 'Rules Import Failed');
    }
    if (isError) {
      return autoSyncActive
        ? t('alerting.import-to-gma.confirm.autosync-error-title', 'Auto-sync Failed')
        : t('alerting.import-to-gma.confirm.error-title', 'Import Failed');
    }
    return autoSyncActive
      ? t('alerting.import-to-gma.confirm.autosync-title', 'Confirm Auto-sync')
      : t('alerting.import-to-gma.confirm.title', 'Confirm Import');
  };

  const getConfirmBody = () => {
    if (autoSyncActive) {
      return (
        <>
          <Trans i18nKey="alerting.import-to-gma.confirm.autosync-body">
            Are you sure you want to enable Auto-sync? Grafana will continuously sync alert configuration from this data
            source until you turn it off in Alerting settings.
          </Trans>
          {rulesPendingNote}
        </>
      );
    }
    return (
      <Trans i18nKey="alerting.import-to-gma.confirm.body">
        Are you sure you want to start the import? This action will create new resources in Grafana Alerting.
      </Trans>
    );
  };

  const getImportingBody = () => {
    if (autoSyncActive) {
      return (
        <>
          <Trans i18nKey="alerting.import-to-gma.confirm.autosync-importing-body">
            Enabling Auto-sync. Please wait...
          </Trans>
          {rulesPendingNote}
        </>
      );
    }
    return (
      <Trans i18nKey="alerting.import-to-gma.confirm.importing-body">
        Importing resources to Grafana Alerting. Please wait...
      </Trans>
    );
  };

  const getSuccessBody = () => {
    if (autoSyncActive) {
      return (
        <>
          <Trans i18nKey="alerting.import-to-gma.confirm.autosync-success-body">
            Auto-sync enabled. Redirecting...
          </Trans>
          {rulesImportedNote}
        </>
      );
    }
    return (
      <Trans i18nKey="alerting.import-to-gma.confirm.success-body">
        Resources imported successfully. Redirecting...
      </Trans>
    );
  };

  const getErrorBody = () => {
    if (isPartialError) {
      return (
        <Trans i18nKey="alerting.import-to-gma.confirm.autosync-rules-error-body">
          Auto-sync was enabled, but importing alert rules failed. Check the error details below and try again.
        </Trans>
      );
    }
    return autoSyncActive ? (
      <Trans i18nKey="alerting.import-to-gma.confirm.autosync-error-body">
        Failed to enable Auto-sync. Please try again.
      </Trans>
    ) : (
      <Trans i18nKey="alerting.import-to-gma.confirm.error-body">
        Failed to import resources. Check the error details below and try again.
      </Trans>
    );
  };

  return (
    <Modal isOpen={isOpen} title={getTitle()} onDismiss={onDismiss}>
      <Stack direction="column" gap={2}>
        {importStatus === 'idle' && <Text>{getConfirmBody()}</Text>}

        {isImporting && (
          <Stack direction="row" gap={2} alignItems="center">
            <Spinner />
            <Text>{getImportingBody()}</Text>
          </Stack>
        )}

        {isSuccess && (
          <Stack direction="row" gap={2} alignItems="center">
            <Icon name="check-circle" size="xl" color="green" />
            <Text>{getSuccessBody()}</Text>
          </Stack>
        )}

        {(isError || isPartialError) && (
          <Stack direction="column" gap={1}>
            <Text color="error">{getErrorBody()}</Text>
            {errorMessage && (
              <Alert severity="error" title={t('alerting.import-to-gma.confirm.error-details', 'Error details')}>
                {errorMessage}
              </Alert>
            )}
          </Stack>
        )}
      </Stack>

      <Modal.ButtonRow>
        {importStatus === 'idle' && (
          <>
            <Button variant="secondary" onClick={onDismiss}>
              {t('alerting.common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" fill="solid" onClick={onConfirm}>
              {autoSyncActive
                ? t('alerting.import-to-gma.confirm.autosync-confirm', 'Enable auto-sync')
                : t('alerting.import-to-gma.confirm.confirm', 'Start Import')}
            </Button>
          </>
        )}

        {(isError || isPartialError) && (
          <Button variant="secondary" onClick={onDismiss}>
            {t('alerting.common.close', 'Close')}
          </Button>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
}
