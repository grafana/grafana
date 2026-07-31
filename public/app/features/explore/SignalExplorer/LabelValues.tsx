import { css } from '@emotion/css';
import { useMemo, useState, type ChangeEvent } from 'react';

import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, IconButton, Input, Text, useStyles2 } from '@grafana/ui';

import { useLabelValues, useVisibleBatch } from './index';

// One reused collator rather than per-comparison `localeCompare`: a high-cardinality label can hold
// thousands of values, and this comparator runs across all of them on every reorder.
const valueCollator = new Intl.Collator();

interface Props {
  /** Set on the container so the label row that expanded it can name it in `aria-controls`. */
  id: string;
  dsUid?: string;
  dsType?: string;
  timeRange: TimeRange;
  metric: string;
  labelKey: string;
}

/**
 * Values of one expanded label key. Mounted only while that label is expanded, and renders at most
 * one batch at a time: a high-cardinality label can hold thousands of values.
 */
export function LabelValues({ id, dsUid, dsType, timeRange, metric, labelKey }: Props) {
  const styles = useStyles2(getStyles);
  const { values, loading, error } = useLabelValues({ uid: dsUid, type: dsType }, timeRange, metric, labelKey, true);

  const [filter, setFilter] = useState('');
  const [ascending, setAscending] = useState(true);
  const { visibleCount, showMore } = useVisibleBatch(filter);

  // Sort first and filter the sorted list, not the other way round: filtering preserves relative
  // order, so the result is identical either way, but this way a keystroke only re-runs the linear
  // filter instead of re-sorting thousands of values.
  const sorted = useMemo(
    () => [...values].sort((a, b) => (ascending ? valueCollator.compare(a, b) : valueCollator.compare(b, a))),
    [values, ascending]
  );

  const ordered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? sorted.filter((value) => value.toLowerCase().includes(needle)) : sorted;
  }, [sorted, filter]);

  const visible = ordered.slice(0, visibleCount);

  const onFilterChange = (event: ChangeEvent<HTMLInputElement>) => setFilter(event.currentTarget.value);
  const filterLabel = t('explore.metrics-list.filter-values', 'Filter values');

  return (
    <div id={id} className={styles.valuesBlock}>
      <div className={styles.valuesToolbar}>
        <Input value={filter} onChange={onFilterChange} aria-label={filterLabel} placeholder={filterLabel} />
        <IconButton
          name={ascending ? 'sort-amount-up' : 'sort-amount-down'}
          aria-label={
            ascending
              ? t('explore.metrics-list.sort-descending', 'Sort descending')
              : t('explore.metrics-list.sort-ascending', 'Sort ascending')
          }
          onClick={() => setAscending((current) => !current)}
        />
      </div>
      {loading && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.metrics-list.loading-values', 'Loading values…')}
        </Text>
      )}
      {error && (
        <Text color="error" variant="bodySmall">
          {t('explore.metrics-list.values-error', 'Failed to load values')}
        </Text>
      )}
      {visible.map((value) => (
        <div key={value} className={styles.valueRow} data-testid="signal-explorer-value-row">
          {value}
        </div>
      ))}
      {ordered.length > visible.length && (
        <Button size="sm" variant="secondary" fill="text" onClick={showMore}>
          {t('explore.metrics-list.show-more', 'Show more')}
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
    fontFamily: theme.typography.fontFamilyMonospace,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
