import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Icon, Modal, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

/**
 * Represents a resource that was renamed during dry-run validation.
 * When importing Alertmanager config, receivers/time intervals with conflicting names
 * get renamed with a suffix (e.g., "my-receiver" → "my-receiver <imported>").
 */
export interface RenamedResource {
  originalName: string;
  newName: string;
}

/**
 * Response from the dry-run validation endpoint.
 * TODO: Update this interface once the backend API is implemented.
 * See: https://github.com/grafana/alerting-squad/issues/1378
 */
export interface DryRunValidationResult {
  /** Whether the validation passed (config is valid and can be merged) */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Receivers that will be renamed due to conflicts with existing receivers */
  renamedReceivers: RenamedResource[];
  /** Time intervals that will be renamed due to conflicts with existing time intervals */
  renamedTimeIntervals: RenamedResource[];
}

interface DryRunValidationModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  /** Current state of the validation */
  state: 'loading' | 'success' | 'warning' | 'error';
  /** Validation result (available when state is not 'loading') */
  result?: DryRunValidationResult;
}

export function DryRunValidationModal({ isOpen, onDismiss, onConfirm, state, result }: DryRunValidationModalProps) {
  const styles = useStyles2(getStyles);

  const hasRenames = result && (result.renamedReceivers.length > 0 || result.renamedTimeIntervals.length > 0);

  const getTitle = () => {
    switch (state) {
      case 'loading':
        return t('alerting.migrate-to-gma.dry-run.title-loading', 'Validating configuration...');
      case 'success':
        return t('alerting.migrate-to-gma.dry-run.title-success', 'Validation successful');
      case 'warning':
        return t('alerting.migrate-to-gma.dry-run.title-warning', 'Validation passed with warnings');
      case 'error':
        return t('alerting.migrate-to-gma.dry-run.title-error', 'Validation failed');
    }
  };

  return (
    <Modal isOpen={isOpen} title={getTitle()} onDismiss={onDismiss}>
      {state === 'loading' && (
        <Stack direction="column" alignItems="center" gap={2}>
          <Spinner size="xl" />
          <Text color="secondary">
            <Trans i18nKey="alerting.migrate-to-gma.dry-run.loading-text">
              Checking your Alertmanager configuration for conflicts...
            </Trans>
          </Text>
        </Stack>
      )}

      {state === 'error' && result && (
        <Stack direction="column" gap={2}>
          <Alert severity="error" title={t('alerting.migrate-to-gma.dry-run.error-title', 'Configuration error')}>
            {result.error || t('alerting.migrate-to-gma.dry-run.error-unknown', 'An unknown error occurred')}
          </Alert>
          <Text color="secondary">
            <Trans i18nKey="alerting.migrate-to-gma.dry-run.error-help">
              Please fix the configuration errors and try again.
            </Trans>
          </Text>
        </Stack>
      )}

      {state === 'success' && (
        <Stack direction="column" gap={2}>
          <div className={styles.successIcon}>
            <Icon name="check-circle" size="xxl" />
          </div>
          <Text color="secondary" textAlignment="center">
            <Trans i18nKey="alerting.migrate-to-gma.dry-run.success-text">
              Your Alertmanager configuration is valid and ready to be imported. No conflicts were detected.
            </Trans>
          </Text>
        </Stack>
      )}

      {state === 'warning' && result && hasRenames && (
        <Stack direction="column" gap={2}>
          <Alert
            severity="warning"
            title={t('alerting.migrate-to-gma.dry-run.warning-title', 'Some resources will be renamed')}
          >
            <Trans i18nKey="alerting.migrate-to-gma.dry-run.warning-text">
              The following resources have names that conflict with existing resources in Grafana. They will be renamed
              automatically during import.
            </Trans>
          </Alert>

          {result.renamedReceivers.length > 0 && (
            <div className={styles.renameSection}>
              <Text variant="h6">{t('alerting.migrate-to-gma.dry-run.renamed-receivers', 'Renamed receivers')}</Text>
              <table className={styles.renameTable}>
                <thead>
                  <tr>
                    <th>{t('alerting.migrate-to-gma.dry-run.original-name', 'Original name')}</th>
                    <th aria-hidden="true" />
                    <th>{t('alerting.migrate-to-gma.dry-run.new-name', 'New name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.renamedReceivers.map((rename, index) => (
                    <tr key={index}>
                      <td>
                        <code>{rename.originalName}</code>
                      </td>
                      <td>
                        <Icon name="arrow-right" />
                      </td>
                      <td>
                        <code>{rename.newName}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.renamedTimeIntervals.length > 0 && (
            <div className={styles.renameSection}>
              <Text variant="h6">
                {t('alerting.migrate-to-gma.dry-run.renamed-time-intervals', 'Renamed time intervals')}
              </Text>
              <table className={styles.renameTable}>
                <thead>
                  <tr>
                    <th>{t('alerting.migrate-to-gma.dry-run.original-name', 'Original name')}</th>
                    <th aria-hidden="true" />
                    <th>{t('alerting.migrate-to-gma.dry-run.new-name', 'New name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.renamedTimeIntervals.map((rename, index) => (
                    <tr key={index}>
                      <td>
                        <code>{rename.originalName}</code>
                      </td>
                      <td>
                        <Icon name="arrow-right" />
                      </td>
                      <td>
                        <code>{rename.newName}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      )}

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          {state === 'error'
            ? t('alerting.migrate-to-gma.dry-run.btn-close', 'Close')
            : t('alerting.migrate-to-gma.dry-run.btn-cancel', 'Cancel')}
        </Button>
        {state !== 'loading' && state !== 'error' && (
          <Button variant="primary" onClick={onConfirm}>
            {state === 'warning'
              ? t('alerting.migrate-to-gma.dry-run.btn-continue-anyway', 'Continue anyway')
              : t('alerting.migrate-to-gma.dry-run.btn-continue', 'Continue')}
          </Button>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  successIcon: css({
    display: 'flex',
    justifyContent: 'center',
    color: theme.colors.success.main,
    marginBottom: theme.spacing(1),
  }),
  renameSection: css({
    marginTop: theme.spacing(1),
  }),
  renameTable: css({
    width: '100%',
    marginTop: theme.spacing(1),
    borderCollapse: 'collapse',

    'th, td': {
      padding: theme.spacing(0.5, 1),
      textAlign: 'left',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },

    'th:nth-child(2), td:nth-child(2)': {
      width: '40px',
      textAlign: 'center',
    },

    th: {
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    },

    code: {
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(0.25, 0.5),
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
    },
  }),
});
