import { css } from '@emotion/css';
import { useMemo, useState, type ChangeEvent } from 'react';

import { type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, IconButton, Input, Text, useStyles2 } from '@grafana/ui';

import { dsKey, rangeKey } from './data/metricResourceClient';
import { useLabelValues } from './data/useLabelValues';
import { useVisibleBatch } from './hooks/useVisibleBatch';

// One reused collator rather than per-comparison `localeCompare`: a high-cardinality label can hold
// thousands of values, and this comparator runs across all of them on every reorder.
const valueCollator = new Intl.Collator();

interface Props {
  /** Set on the container so the label row that expanded it can name it in `aria-controls`. */
  id: string;
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  metric: string;
  labelKey: string;
}

/**
 * Values of one expanded label key. Mounted only while that label is expanded, and renders at most
 * one batch at a time: a high-cardinality label can hold thousands of values.
 */
export function LabelValues({ id, dsRef, timeRange, metric, labelKey }: Props) {
  const styles = useStyles2(getStyles);
  const { values, loading, error } = useLabelValues(dsRef, timeRange, metric, labelKey);

  const [filter, setFilter] = useState('');
  const [ascending, setAscending] = useState(true);

  // Paging resets on anything that swaps the list out for a different one: the filter, but also the
  // datasource and the range, which this block stays mounted across. Sort direction is deliberately
  // not in here — flipping it reorders the same members, so paging depth is worth keeping.
  const { visibleCount, showMore } = useVisibleBatch(`${dsKey(dsRef)}|${rangeKey(timeRange)}|${filter}`);

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
    // The container stays a `div` because it holds the toolbar, the status text and the "show more"
    // button as well as the rows, and a `ul` may only contain `li`. It carries the id, so the label
    // row's `aria-controls` keeps resolving to it.
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
      {/* `role="alert"` because the block appears in place of the loading text, with nothing focused
          and no other cue that the values the user expanded the label for are not coming. */}
      {error && (
        <Text color="error" variant="bodySmall" role="alert">
          {t('explore.metrics-list.values-error', 'Failed to load values')}: {error.message}
        </Text>
      )}
      {/* Only once there is a row to put in it: an empty list is still announced as a list. */}
      {visible.length > 0 && (
        <ul className={styles.valueList}>
          {visible.map((value) => (
            <li key={value} className={styles.valueRow} data-testid="signal-explorer-value-row">
              {value}
            </li>
          ))}
        </ul>
      )}
      {ordered.length > visible.length && (
        // The visible text stays short for the rail, but the accessible name says which list this
        // extends: the metric list's own "Show more" can be in the same scroll region as this one.
        <Button
          size="sm"
          variant="secondary"
          fill="text"
          aria-label={t('explore.metrics-list.show-more-values', 'Show more values')}
          onClick={showMore}
        >
          {t('explore.metrics-list.show-more', 'Show more')}
        </Button>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  valuesBlock: css({
    label: 'label-values-block',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.25),
    marginLeft: theme.spacing(2),
    paddingLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  valuesToolbar: css({
    label: 'label-values-toolbar',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.5, 0),
  }),
  valueList: css({
    label: 'label-values-list',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    width: '100%',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  valueRow: css({
    label: 'label-values-row',
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
