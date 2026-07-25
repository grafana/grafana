import { css } from '@emotion/css';
import { useMemo, useState, type ChangeEvent } from 'react';

import { type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, IconButton, Input, Text, useStyles2 } from '@grafana/ui';

import { useLabelValues } from '../data/useLabelValues';

import { useVisibleBatch } from './useVisibleBatch';

// A single reused collator rather than per-comparison `localeCompare`: a high-cardinality label
// can hold thousands of values, and this comparator runs across all of them on every reorder.
const valueCollator = new Intl.Collator();

export interface LabelValuesBlockProps {
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  metric: string;
  labelKey: string;
}

/**
 * Values of one expanded label key. Mounted only while that label is expanded, and renders at most
 * one batch at a time: a high-cardinality label can hold thousands of values.
 */
export function LabelValuesBlock({ dsRef, timeRange, metric, labelKey }: LabelValuesBlockProps) {
  const styles = useStyles2(getStyles);
  const { values, loading, error } = useLabelValues(dsRef, timeRange, metric, labelKey, true);

  const [filter, setFilter] = useState('');
  const [ascending, setAscending] = useState(true);
  const { visibleCount, showMore } = useVisibleBatch(filter);

  const ordered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const matching = needle ? values.filter((value) => value.toLowerCase().includes(needle)) : values;
    return [...matching].sort((a, b) => (ascending ? valueCollator.compare(a, b) : valueCollator.compare(b, a)));
  }, [values, filter, ascending]);

  const visible = ordered.slice(0, visibleCount);

  const onFilterChange = (event: ChangeEvent<HTMLInputElement>) => setFilter(event.currentTarget.value);

  const filterLabel = t('explore.signal-explorer.tree.filter-values', 'Filter values');

  return (
    <div className={styles.valuesBlock}>
      <div className={styles.valuesToolbar}>
        <Input value={filter} onChange={onFilterChange} aria-label={filterLabel} placeholder={filterLabel} />
        <IconButton
          name={ascending ? 'sort-amount-up' : 'sort-amount-down'}
          aria-label={
            ascending
              ? t('explore.signal-explorer.tree.sort-descending', 'Sort descending')
              : t('explore.signal-explorer.tree.sort-ascending', 'Sort ascending')
          }
          onClick={() => setAscending((current) => !current)}
        />
      </div>
      {loading && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.signal-explorer.tree.loading-values', 'Loading values…')}
        </Text>
      )}
      {error && (
        <Text color="error" variant="bodySmall">
          {t('explore.signal-explorer.tree.values-error', 'Failed to load values')}
        </Text>
      )}
      {visible.map((value) => (
        <div key={value} className={styles.valueRow} data-testid="signal-explorer-value-row">
          {value}
        </div>
      ))}
      {ordered.length > visible.length && (
        <Button size="sm" variant="secondary" fill="text" onClick={showMore}>
          {t('explore.signal-explorer.tree.show-more', 'Show more')}
        </Button>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  valuesBlock: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.25),
    marginLeft: theme.spacing(2),
    paddingLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  valuesToolbar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.5, 0),
  }),
  valueRow: css({
    overflow: 'hidden',
    maxWidth: '100%',
    padding: theme.spacing(0, 0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
