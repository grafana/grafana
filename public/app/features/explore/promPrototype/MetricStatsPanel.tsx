// Prototype-only. Not internationalized.
// Docked stats card for a selected metric. Shows only:
//   - Type badge (COUNTER / GAUGE / HISTOGRAM / SUMMARY)
//   - Metric name
//   - Help text
//   - Status + last scraped
//   - Active series + scrape interval (side-by-side)

import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { type MetricType, type MockMetric } from './prometheusMockCatalog';

interface Props {
  metric: MockMetric;
  onClose?: () => void;
}

const TYPE_LABEL: Record<MetricType, string> = {
  counter: 'Counter',
  gauge: 'Gauge',
  histogram: 'Histogram',
  summary: 'Summary',
};

const TYPE_BG: Record<MetricType, string> = {
  counter: '#3d71d9',
  gauge: '#2f7a3e',
  histogram: '#c25e0a',
  summary: '#6d40c9',
};

export function MetricStatsPanel({ metric, onClose }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.typeBadge} style={{ background: TYPE_BG[metric.type] }}>
            {TYPE_LABEL[metric.type]}
          </span>
          <h3 className={styles.metricName} title={metric.name}>
            {metric.name}
          </h3>
          {metric.help && <p className={styles.help}>{metric.help}</p>}
        </div>
        {onClose && <IconButton name="times" aria-label="Close" onClick={onClose} />}
      </div>

      <div className={styles.divider} />

      <div className={styles.status}>Active, last scraped {metric.lastScrapedSecondsAgo}s ago</div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Series</div>
          <div className={styles.statValue}>{formatNum(metric.activeSeries)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Interval</div>
          <div className={styles.statValue}>{metric.scrapeIntervalSec}s</div>
        </div>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    minWidth: 260,
  }),
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  }),
  headerLeft: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    minWidth: 0,
    flex: 1,
  }),
  typeBadge: css({
    display: 'inline-block',
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.maxContrast,
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  }),
  metricName: css({
    margin: 0,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    wordBreak: 'break-all',
    lineHeight: 1.3,
  }),
  help: css({
    margin: 0,
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    lineHeight: 1.4,
  }),
  divider: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  status: css({
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  }),
  statsRow: css({
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1),
  }),
  statCard: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  statLabel: css({
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  }),
  statValue: css({
    fontSize: theme.typography.h4.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
