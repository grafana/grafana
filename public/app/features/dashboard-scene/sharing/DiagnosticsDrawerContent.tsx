import { css } from '@emotion/css';
import { type ReactNode, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Button, Checkbox, useStyles2 } from '@grafana/ui';

interface DiagnosticsDrawerContentProps {
  description: ReactNode;
  progress?: ReactNode;
  error?: Error;
  isGenerating: boolean;
  onDownload: (includeLogs: boolean) => void;
  onDismiss: () => void;
}

export function DiagnosticsDrawerContent({
  description,
  progress,
  error,
  isGenerating,
  onDownload,
  onDismiss,
}: DiagnosticsDrawerContentProps) {
  const styles = useStyles2(getStyles);
  // Default-on here so admins get useful bundles by default; the request helpers default includeLogs
  // to false, so this drawer selection is the only thing that opts a request into log capture.
  const [includeLogs, setIncludeLogs] = useState(true);

  return (
    <div>
      <p className={styles.info}>{description}</p>

      <Alert
        severity="warning"
        title={t('dashboard.diagnostics.sensitive-warning-title', 'May contain sensitive data')}
      >
        <Trans i18nKey="dashboard.diagnostics.sensitive-warning-body">
          The bundle can include request headers, query parameters, and server log lines. Review it before sharing
          outside your organization.
        </Trans>
      </Alert>

      <Checkbox
        label={t('dashboard.diagnostics.include-server-logs', 'Include server logs')}
        // Checkbox renders its description inside the wrapping label, so provide the concise
        // accessible name explicitly instead of including the full description in it.
        aria-label={t('dashboard.diagnostics.include-server-logs', 'Include server logs')}
        description={t(
          'dashboard.diagnostics.include-server-logs-description',
          'Adds filtered query logs and a bounded unfiltered server-log window to the bundle.'
        )}
        value={includeLogs}
        disabled={isGenerating}
        onChange={(event) => setIncludeLogs(event.currentTarget.checked)}
      />

      {progress && <p className={styles.info}>{progress}</p>}

      {error && (
        <Alert severity="error" title={t('dashboard.diagnostics.error-title', 'Failed to generate diagnostics')}>
          {diagnosticsErrorMessage(error)}
        </Alert>
      )}

      <div
        className={styles.buttonRow}
        role="group"
        aria-label={t('dashboard.diagnostics.actions', 'Diagnostics actions')}
      >
        <Button variant="primary" onClick={() => onDownload(includeLogs)} disabled={isGenerating} icon="download-alt">
          {isGenerating ? (
            <Trans i18nKey="dashboard.diagnostics.generating-button">Generating…</Trans>
          ) : (
            <Trans i18nKey="dashboard.diagnostics.download-button">Download diagnostics</Trans>
          )}
        </Button>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="dashboard.diagnostics.cancel-button">Cancel</Trans>
        </Button>
      </div>
    </div>
  );
}

// The download uses blob/json fetches whose FetchError carries the detail in status/statusText, so
// build the message from those rather than error.message (which would leave the alert body empty).
function diagnosticsErrorMessage(error: Error): string {
  if (isFetchError(error)) {
    const parts = [error.status, error.statusText].filter(Boolean);
    return parts.length ? parts.join(' ') : t('dashboard.diagnostics.request-failed', 'Request failed');
  }
  return error.message || t('dashboard.diagnostics.error-title', 'Failed to generate diagnostics');
}

const getStyles = (theme: GrafanaTheme2) => ({
  info: css({
    marginBottom: theme.spacing(2),
  }),
  buttonRow: css({
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  }),
});
