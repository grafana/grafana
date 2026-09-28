import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, TextLink, useStyles2 } from '@grafana/ui';

export const AdaptiveTracesRestoredBanner = () => {
  const styles = useStyles2(getStyles);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Alert
        severity="info"
        title={t('explore.trace-view.adaptive-traces-restored.title', 'Trace restored by Adaptive Traces')}
        onRemove={() => setDismissed(true)}
      >
        <Trans i18nKey="explore.trace-view.adaptive-traces-restored.body">
          This trace was originally dropped by Adaptive Traces and has been restored. A restored trace is not included
          in TraceQL queries and can only be queried by trace ID. Please review the{' '}
          <TextLink
            href="https://grafana.com/docs/grafana-cloud/adaptive-telemetry/adaptive-traces/query-dropped-traces/"
            external
          >
            documentation
          </TextLink>{' '}
          for more details.
        </Trans>
      </Alert>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});
