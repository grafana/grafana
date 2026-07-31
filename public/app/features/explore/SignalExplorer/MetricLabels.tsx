import { css } from '@emotion/css';

import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { LabelValues } from './LabelValues';
import { blockId } from './blockId';

import { useMetricDetail } from './index';

interface Props {
  /** Set on the container, and the base for each label row's own values-block id. */
  id: string;
  dsUid?: string;
  dsType?: string;
  timeRange: TimeRange;
  metric: string;
  expandedLabel: string | null;
  onToggleLabel: (labelKey: string) => void;
}

/**
 * Label keys of one expanded metric. Mounted only while that row is expanded — the laziness comes
 * from mounting, which is also what keeps `useMetricDetail` out of a render loop over the rows.
 */
export function MetricLabels({ id, dsUid, dsType, timeRange, metric, expandedLabel, onToggleLabel }: Props) {
  const styles = useStyles2(getStyles);
  const { labelKeys, loading, error } = useMetricDetail({ uid: dsUid, type: dsType }, timeRange, metric, true);

  return (
    <div id={id} className={styles.labelsBlock}>
      {loading && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.metrics-list.loading-labels', 'Loading labels…')}
        </Text>
      )}
      {error && (
        <Text color="error" variant="bodySmall">
          {t('explore.metrics-list.labels-error', 'Failed to load labels')}
        </Text>
      )}
      {labelKeys.map((labelKey) => {
        const expanded = labelKey === expandedLabel;
        const valuesId = blockId(id, 'values', labelKey);

        return (
          <div key={labelKey} className={styles.label}>
            <button
              type="button"
              className={styles.labelRow}
              aria-expanded={expanded}
              aria-controls={expanded ? valuesId : undefined}
              aria-label={
                expanded
                  ? t('explore.metrics-list.hide-values', 'Hide values for {{label}}', { label: labelKey })
                  : t('explore.metrics-list.show-values', 'Show values for {{label}}', { label: labelKey })
              }
              onClick={() => onToggleLabel(labelKey)}
            >
              <Icon name={expanded ? 'angle-down' : 'angle-right'} />
              {labelKey}
            </button>
            {expanded && (
              <LabelValues
                id={valuesId}
                dsUid={dsUid}
                dsType={dsType}
                timeRange={timeRange}
                metric={metric}
                labelKey={labelKey}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  labelsBlock: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    marginLeft: theme.spacing(2),
    paddingLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  label: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  labelRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.radius.default,
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
});
