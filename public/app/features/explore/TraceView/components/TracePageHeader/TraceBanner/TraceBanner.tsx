import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { formatDuration } from '../../utils/date';
import { getServiceDisplayName } from '../../utils/service-name';

import { type TraceBannerHighlight, getSpanTracePercentLabel, getTraceBannerOperationLabel } from './findTraceBanner';

type TraceBannerProps = {
  highlight: TraceBannerHighlight;
  traceDuration: number;
  onGoToSpan: (spanId: string) => void;
};

export function TraceBanner({ highlight, traceDuration, onGoToSpan }: TraceBannerProps) {
  const styles = useStyles2(getStyles);
  const { span, severity } = highlight;
  const serviceName = getServiceDisplayName(span.process);
  const operationLabel = getTraceBannerOperationLabel(span);
  const percent = getSpanTracePercentLabel(span.duration, traceDuration);
  const metrics = t('explore.trace-page-header.trace-banner-metrics', '{{duration}} · {{percent}}% of trace', {
    duration: formatDuration(span.duration),
    percent,
    // i18next escapes this on render; without opting out here the "<" of a "<0.1" share reads as "&lt;".
    interpolation: { escapeValue: false },
  });
  const bannerLabel =
    severity === 'error'
      ? t('explore.trace-page-header.trace-banner-error', 'Trace error banner')
      : t('explore.trace-page-header.trace-banner-warning', 'Trace warning banner');

  return (
    <div
      className={cx(styles.banner, severity === 'error' ? styles.errorBanner : styles.warningBanner)}
      data-testid={selectors.components.TraceViewer.traceBanner.container}
      role="region"
      aria-label={bannerLabel}
    >
      {/*
        What you see (one row):
          {service}  {operation}              {duration} · {percent}% of trace  Go to span
          payment-service  POST /payments/authorize   1.42s · 58.9% of trace  Go to span

        Operation is always "METHOD path" or a fallback:
          method + route/path  →  POST /payments/authorize
          method only          →  POST {operationName}
          no HTTP tags         →  db.query

        Two method key names exist because exporters disagree (http.request.method vs
        http.method). Same for path (http.route vs http.target / http.path / http.url).
      */}
      <div className={styles.row} data-testid={selectors.components.TraceViewer.traceBanner.row(span.spanID)}>
        <div className={styles.identity}>
          <span className={cx(styles.serviceName, severity === 'error' ? styles.errorText : styles.warningText)}>
            {serviceName}
          </span>
          <span className={styles.operationName}>{operationLabel}</span>
        </div>
        <div className={styles.actions}>
          <span className={styles.metrics}>{metrics}</span>
          <Button
            variant="secondary"
            fill="outline"
            size="sm"
            onClick={() => onGoToSpan(span.spanID)}
            data-testid={selectors.components.TraceViewer.traceBanner.goToSpanButton}
          >
            {t('explore.trace-page-header.trace-banner-go-to-span', 'Go to span')}
          </Button>
        </div>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    display: 'flex',
    flexDirection: 'column',
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.radius.default,
    border: '1px solid',
  }),
  errorBanner: css({
    backgroundColor: theme.colors.error.transparent,
    borderColor: theme.colors.error.border,
  }),
  warningBanner: css({
    backgroundColor: theme.colors.warning.transparent,
    borderColor: theme.colors.warning.border,
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    minWidth: 0,
  }),
  identity: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  serviceName: css({
    fontWeight: theme.typography.fontWeightMedium,
    flexShrink: 0,
  }),
  errorText: css({
    color: theme.colors.error.text,
  }),
  warningText: css({
    color: theme.colors.warning.text,
  }),
  operationName: css({
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  }),
  metrics: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  }),
});
