import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { getMetricTypeLabel } from '../data/metricType';
import type { MetricRow, MetricType } from '../types';

export interface MetricMetadataBlockProps {
  /**
   * The selected metric's name, known as soon as the user clicks a row. Separate from `metric` so the
   * block can name what was selected while the catalog describing it is still loading.
   */
  metricName: string;
  /** The catalog entry for `metricName`, once resolved. Type, help and unit appear with it. */
  metric: MetricRow | undefined;
  onClose: () => void;
}

/**
 * The docked description of the selected metric. Renders only when something is selected — the host
 * decides that, because "nothing is selected" means "no block", not "an empty block".
 */
export function MetricMetadataBlock({ metricName, metric, onClose }: MetricMetadataBlockProps) {
  const styles = useStyles2(getStyles);
  const closeLabel = t('explore.signal-explorer.metadata.close', 'Close');

  const typeLabel = useMemo(() => (metric ? getMetricTypeLabel(metric.type) : undefined), [metric]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {metric && typeLabel && (
          <span
            className={cxTypeBadge(styles, metric.type)}
            data-testid="signal-explorer-metric-type-badge"
            data-metric-type={metric.type}
          >
            {typeLabel}
          </span>
        )}
        <IconButton className={styles.closeButton} name="times" aria-label={closeLabel} onClick={onClose} />
      </div>
      <Stack direction="column" gap={0.5}>
        {/* A metric name can be very long and has no spaces to wrap on, so it is broken mid-token
            rather than allowed to push the dock wider than the sidebar. */}
        <Text element="h4" truncate={false}>
          <span className={styles.metricName}>{metricName}</span>
        </Text>
        {metric?.help && <Text color="secondary">{metric.help}</Text>}
        {metric?.unit && (
          <div className={styles.unitRow} data-testid="metric-metadata-unit">
            <Text variant="bodySmall" color="secondary">
              {t('explore.signal-explorer.metadata.unit-label', 'Unit')}
            </Text>
            <Text variant="bodySmall">{metric.unit}</Text>
          </div>
        )}
      </Stack>
    </div>
  );
}

const cxTypeBadge = (styles: ReturnType<typeof getStyles>, type: MetricType) => `${styles.typeBadge} ${styles[type]}`;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.primary,
    // Without this the long, unbroken metric name below sets the dock's width.
    minWidth: 0,
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  typeBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.maxContrast,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.fontWeightBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  }),
  // One colour per type, so the type reads at a glance. Semantic theme colours rather than the
  // prototype's raw hexes: these are the same hues but they follow the light/dark theme, which a
  // fixed hex on a fixed `maxContrast` foreground would not.
  counter: css({ background: theme.colors.primary.main }),
  gauge: css({ background: theme.colors.success.main }),
  histogram: css({ background: theme.colors.warning.main }),
  'native histogram': css({ background: theme.visualization.getColorByName('purple') }),
  summary: css({ background: theme.visualization.getColorByName('super-light-purple') }),
  unknown: css({ background: theme.colors.secondary.main }),
  closeButton: css({
    marginLeft: 'auto',
  }),
  metricName: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    // `break-all`: a metric name is one long token, so normal wrapping never finds a break point.
    wordBreak: 'break-all',
  }),
  unitRow: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.5),
  }),
});
