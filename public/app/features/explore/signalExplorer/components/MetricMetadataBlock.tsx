import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { getMetricTypeOptions } from '../data/metricType';
import type { MetricRow } from '../types';

export interface MetricMetadataBlockProps {
  metric: MetricRow | undefined;
  onClose: () => void;
}

export function MetricMetadataBlock({ metric, onClose }: MetricMetadataBlockProps) {
  const styles = useStyles2(getStyles);
  const typeOptions = useMemo(() => getMetricTypeOptions(), []);
  const closeLabel = t('explore.signal-explorer.metadata.close', 'Close');

  const typeLabel = metric
    ? (typeOptions.find((option) => option.value === metric.type)?.label ?? metric.type)
    : undefined;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {typeLabel && <span className={styles.typeBadge}>{typeLabel}</span>}
        <IconButton className={styles.closeButton} name="times" aria-label={closeLabel} onClick={onClose} />
      </div>
      {metric ? (
        <Stack direction="column" gap={0.5}>
          <Text element="h4">{metric.name}</Text>
          {metric.help && <Text color="secondary">{metric.help}</Text>}
          {metric.unit && (
            <div className={styles.unitRow} data-testid="metric-metadata-unit">
              <Text variant="bodySmall" color="secondary">
                {t('explore.signal-explorer.metadata.unit-label', 'Unit')}
              </Text>
              <Text variant="bodySmall">{metric.unit}</Text>
            </div>
          )}
        </Stack>
      ) : (
        <Text color="secondary">
          {t('explore.signal-explorer.metadata.empty', 'Select a metric to see its details')}
        </Text>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  typeBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.sm,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  closeButton: css({
    marginLeft: 'auto',
  }),
  unitRow: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.5),
  }),
});
