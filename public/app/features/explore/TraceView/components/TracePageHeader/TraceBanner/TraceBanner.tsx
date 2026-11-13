import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Icon, useStyles2 } from '@grafana/ui';

import { getSpanException } from '../../TraceTimelineViewer/SpanDetail/exceptions/span-exception';
import { formatSummaryDuration } from '../../utils/date';
import { getServiceDisplayName } from '../../utils/service-name';

import {
  type TraceBannerHighlight,
  getSpanTracePercentLabel,
  getTraceBannerOperationLabel,
  getTraceBannerStatusCode,
} from './findTraceBanner';

const EXCEPTION_TYPE_KEY = 'exception.type';
const EXCEPTION_MESSAGE_KEY = 'exception.message';
const EXCEPTION_STACKTRACE_KEY = 'exception.stacktrace';

type TraceBannerProps = {
  highlight: TraceBannerHighlight;
  traceDuration: number;
  onGoToSpan: (spanId: string) => void;
  onExceptionToggle?: (isOpen: boolean) => void;
  onLayoutChange?: () => void;
};

export function TraceBanner({
  highlight,
  traceDuration,
  onGoToSpan,
  onExceptionToggle,
  onLayoutChange,
}: TraceBannerProps) {
  const styles = useStyles2(getStyles);
  const { span, severity } = highlight;
  const [isOpen, setIsOpen] = useState(false);
  const [isStacktraceOpen, setIsStacktraceOpen] = useState(false);
  const [expandedSpan, setExpandedSpan] = useState({ traceID: span.traceID, spanID: span.spanID });
  if (expandedSpan.traceID !== span.traceID || expandedSpan.spanID !== span.spanID) {
    setExpandedSpan({ traceID: span.traceID, spanID: span.spanID });
    setIsOpen(false);
    setIsStacktraceOpen(false);
  }
  const exception = getSpanException(span);
  const serviceName = getServiceDisplayName(span.process);
  const operationLabel = getTraceBannerOperationLabel(span);
  const statusCode = getTraceBannerStatusCode(span);
  const percent = getSpanTracePercentLabel(span.duration, traceDuration);
  const metrics = t('explore.trace-page-header.trace-banner-metrics', '{{duration}} · {{percent}}% of trace', {
    duration: formatSummaryDuration(span.duration),
    percent,
    // i18next escapes this on render; without opting out here the "<" of a "<0.1" share reads as "&lt;".
    interpolation: { escapeValue: false },
  });
  const isError = severity === 'error';
  const statusLabel = isError
    ? statusCode
      ? t('explore.trace-page-header.trace-summary-error-status', 'Error: {{status}}', { status: statusCode })
      : t('explore.trace-page-header.trace-summary-error', 'Error')
    : statusCode
      ? t('explore.trace-page-header.trace-summary-warning-status', 'Warning: {{status}}', { status: statusCode })
      : t('explore.trace-page-header.trace-summary-warning', 'Warning');
  const bannerLabel = isError
    ? t('explore.trace-page-header.trace-banner-error', 'Trace error banner')
    : t('explore.trace-page-header.trace-banner-warning', 'Trace warning banner');
  const detailsId = `trace-summary-details-${span.spanID}`;

  useEffect(() => {
    onLayoutChange?.();
  }, [isOpen, isStacktraceOpen, onLayoutChange]);

  const identity = (
    <>
      {exception && <Icon name={isOpen ? 'angle-down' : 'angle-right'} />}
      <span className={cx(styles.status, isError ? styles.errorText : styles.warningText)}>{statusLabel}</span>
      <span className={styles.serviceName}>{serviceName}</span>
      <span className={styles.operationName}>{operationLabel}</span>
    </>
  );

  return (
    <div
      className={cx(styles.banner, isError ? styles.errorAccent : styles.warningAccent)}
      data-testid={selectors.components.TraceViewer.traceBanner.container}
      role="region"
      aria-label={bannerLabel}
    >
      {/*
        Neutral card: the trace signal is erroring, not Grafana.
        Operation is "METHOD path", method plus the span name, or the span name alone.
      */}
      <div className={styles.row} data-testid={selectors.components.TraceViewer.traceBanner.row(span.spanID)}>
        {exception ? (
          <button
            type="button"
            className={styles.summaryToggle}
            aria-expanded={isOpen}
            aria-controls={detailsId}
            onClick={() => {
              const next = !isOpen;
              onExceptionToggle?.(next);
              setIsOpen(next);
            }}
            data-testid={selectors.components.TraceViewer.traceBanner.toggleButton}
          >
            {identity}
          </button>
        ) : (
          <div className={styles.summaryToggle}>{identity}</div>
        )}
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
      {exception && isOpen && (
        <div className={styles.details} id={detailsId}>
          {(exception.type || exception.message) && (
            <div className={styles.fields}>
              {exception.type && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>{EXCEPTION_TYPE_KEY}</span>
                  <span className={cx(styles.fieldValue, isError ? styles.errorText : styles.warningText)}>
                    {exception.type}
                  </span>
                </div>
              )}
              {exception.message && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>{EXCEPTION_MESSAGE_KEY}</span>
                  <span className={styles.fieldValue}>{exception.message}</span>
                </div>
              )}
            </div>
          )}
          {exception.stacktrace && (
            <button
              type="button"
              className={styles.stacktraceToggle}
              aria-expanded={isStacktraceOpen}
              onClick={() => setIsStacktraceOpen((open) => !open)}
              data-testid={selectors.components.TraceViewer.traceBanner.stacktraceButton}
            >
              <Icon name={isStacktraceOpen ? 'angle-down' : 'angle-right'} />
              {isStacktraceOpen
                ? t('explore.trace-page-header.trace-summary-hide-stacktrace', 'Hide stacktrace')
                : t('explore.trace-page-header.trace-summary-show-stacktrace', 'Show stacktrace')}
              <span className={styles.attributeKey}>{EXCEPTION_STACKTRACE_KEY}</span>
            </button>
          )}
          {exception.stacktrace && isStacktraceOpen && (
            <pre className={styles.stacktraceBody}>{exception.stacktrace}</pre>
          )}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  errorAccent: css({
    borderLeft: `4px solid ${theme.colors.error.main}`,
  }),
  warningAccent: css({
    borderLeft: `4px solid ${theme.colors.warning.main}`,
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    minWidth: 0,
  }),
  summaryToggle: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flex: 1,
    minWidth: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',

    'button&': {
      cursor: 'pointer',
    },
  }),
  status: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: theme.typography.body.lineHeight,
    flexShrink: 0,
  }),
  errorText: css({
    color: theme.colors.error.text,
  }),
  warningText: css({
    color: theme.colors.warning.text,
  }),
  serviceName: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: theme.typography.body.lineHeight,
    flexShrink: 0,
  }),
  operationName: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.body.lineHeight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexShrink: 0,
  }),
  metrics: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.bodySmall.lineHeight,
    whiteSpace: 'nowrap',
  }),
  details: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    paddingLeft: theme.spacing(3),
  }),
  fields: css({
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    columnGap: theme.spacing(6),
    alignItems: 'start',
  }),
  field: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    minWidth: 0,
  }),
  fieldLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.bodySmall.lineHeight,
  }),
  fieldValue: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: theme.typography.body.lineHeight,
    wordBreak: 'break-word',
  }),
  stacktraceToggle: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    alignSelf: 'flex-start',
    padding: 0,
    border: 'none',
    background: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.bodySmall.lineHeight,
  }),
  attributeKey: css({
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
  }),
  stacktraceBody: css({
    // The banner lives in the sticky trace header, so an uncapped stacktrace would cover the timeline.
    maxHeight: '300px',
    overflowY: 'auto',
    margin: 0,
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});
